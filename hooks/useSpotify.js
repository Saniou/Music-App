import { useEffect } from "react";
import { signIn, useSession } from "next-auth/react";

// The user's access token for browser-side Web API calls (lib/api.js). No client secret here.
let accessToken = null;
export const spotifyAuth = {
  setAccessToken: (token) => {
    accessToken = token;
  },
  getAccessToken: () => accessToken,
};

// Keeps spotifyAuth's token in step with the NextAuth session.
function useSpotify() {
  const { data: session } = useSession();

  useEffect(() => {
    if (!session) return;

    // If the refresh failed, force a fresh sign-in.
    if (session.error === "RefreshAccessTokenError") {
      signIn();
      return;
    }

    spotifyAuth.setAccessToken(session.user.accessToken);
  }, [session]);
}

export default useSpotify;
