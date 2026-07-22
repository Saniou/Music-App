import SpotifyWebApi from "spotify-web-api-node";

// Scopes must be space-separated per the Spotify OAuth spec.
const scopes = [
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "user-read-recently-played",
  "user-top-read",
  "user-library-read",
  "user-follow-read",
  "playlist-read-private",
  "playlist-read-collaborative",
  "streaming",
].join(" ");

// Server-side client used only by NextAuth to exchange/refresh tokens.
// Credentials are read from server-only env vars (never NEXT_PUBLIC_*).
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

export { scopes, spotifyApi };
