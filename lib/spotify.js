// Scopes must be space-separated per the Spotify OAuth spec.
export const scopes = [
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "user-read-recently-played",
  "user-top-read",
  "user-library-read",
  "user-library-modify", // like/unlike via /me/library; older sessions need to sign in again
  "user-follow-read",
  "playlist-read-private",
  "playlist-read-collaborative",
  "streaming",
].join(" ");

// Server side only (NextAuth): trade a refresh token for a new access token. The client secret comes
// from server-only env vars (never NEXT_PUBLIC_*).
export async function refreshSpotifyToken(refreshToken) {
  const credentials = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) throw new Error(`Spotify token refresh failed (${res.status}): ${data?.error ?? "no token"}`);
  return data; // { access_token, expires_in, refresh_token? }
}
