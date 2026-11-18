import { spotifyApi } from "@/hooks/useSpotify";

// Direct Web API calls. spotify-web-api-node predates the Feb 2026 Dev Mode endpoints
// (/playlists/{id}/items, /me/library, reading the queue), so newer calls go through here.
async function request(method, path, body) {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${spotifyApi.getAccessToken()}`,
      ...(body && { "Content-Type": "application/json" }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  const text = await res.text(); // 204s and some PUTs have no body
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}
  if (!res.ok) throw { statusCode: res.status, body: data };
  return data;
}

export const apiGet = (path) => request("GET", path);
export const apiSend = (method, path, body) => request(method, path, body);
export const qs = (params) => new URLSearchParams(params).toString();
