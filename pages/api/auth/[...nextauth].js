import NextAuth from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";
import { refreshSpotifyToken, scopes } from "@/lib/spotify";

async function refreshAccessToken(token) {
  try {
    const refreshedToken = await refreshSpotifyToken(token.refreshToken);

    return {
      ...token,
      accessToken: refreshedToken.access_token,
      accessTokenExpires: Date.now() + refreshedToken.expires_in * 1000,
      // Spotify may or may not return a new refresh token; fall back to the old one.
      refreshToken: refreshedToken.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch (error) {
    console.error("Failed to refresh Spotify access token", error);
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

export const authOptions = {
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      authorization: {
        url: "https://accounts.spotify.com/authorize",
        // show_dialog forces Spotify to re-show consent so a login always
        // grants the current scope set (avoids stale tokens after scope changes).
        params: { scope: scopes, show_dialog: true },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, account, user }) {
      // Initial sign in.
      if (account && user) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          username: account.providerAccountId,
          accessTokenExpires: account.expires_at * 1000,
          scope: account.scope ?? null, // scopes Spotify actually granted
        };
      }

      // Return the existing token while it is still valid.
      if (Date.now() < token.accessTokenExpires) {
        return token;
      }

      // Otherwise refresh it.
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.user = {
        ...session.user,
        // The refresh token stays in the encrypted JWT cookie; the browser never needs it.
        accessToken: token.accessToken,
        username: token.username,
        scope: token.scope ?? null,
      };
      // Use null (not undefined) — getServerSideProps can't serialize undefined.
      session.error = token.error ?? null;
      return session;
    },
  },
};

export default NextAuth(authOptions);
