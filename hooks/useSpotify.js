import { useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import SpotifyWebApi from "spotify-web-api-node";

// Browser-side client. It only ever needs the user's access token — no client
// secret is exposed here. A single shared instance keeps the token in one place.
const spotifyApi = new SpotifyWebApi();

function useSpotify() {
  const { data: session } = useSession();

  useEffect(() => {
    if (!session) return;

    // If the refresh failed, force a fresh sign-in.
    if (session.error === "RefreshAccessTokenError") {
      signIn();
      return;
    }

    spotifyApi.setAccessToken(session.user.accessToken);
  }, [session]);

  return spotifyApi;
}

export default useSpotify;
