import { spotifyApi } from "@/hooks/useSpotify";

// Direct Web API calls. spotify-web-api-node predates the Feb 2026 Dev Mode endpoints
// (/playlists/{id}/items, /me/library, reading the queue), so newer calls go through here.

// Dev Mode's rate limit is small and shared by the whole developer account. On a 429, Spotify says
// how long to back off (Retry-After); every call waits that out together instead of hammering it,
// then the failed call retries by itself.
const MAX_RETRIES = 2;
const MAX_BACKOFF_MS = 20_000;
let pausedUntil = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const isRateLimited = () => Date.now() < pausedUntil;
export function backOff(retryAfterSeconds, attempt = 0) {
  const s = Number(retryAfterSeconds);
  const ms = Math.min(Number.isFinite(s) && s > 0 ? s * 1000 : 2000 * (attempt + 1), MAX_BACKOFF_MS);
  pausedUntil = Math.max(pausedUntil, Date.now() + ms);
}

async function request(method, path, body, attempt = 0) {
  const wait = pausedUntil - Date.now();
  if (wait > 0) await sleep(wait);
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${spotifyApi.getAccessToken()}`,
      ...(body && { "Content-Type": "application/json" }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  if (res.status === 429 && attempt < MAX_RETRIES) {
    backOff(res.headers.get("Retry-After"), attempt);
    return request(method, path, body, attempt + 1);
  }
  const text = await res.text(); // 204s and some PUTs have no body
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}
  if (!res.ok) throw { statusCode: res.status, body: data };
  return data;
}

// Artists and albums barely change: keep them 10 minutes, so going back and forth between pages
// costs no requests. Failures aren't kept.
const CACHE_MS = 10 * 60_000;
const cache = new Map();
const cacheable = (path) => /^\/(artists|albums)\//.test(path);

export function apiGet(path) {
  if (!cacheable(path)) return request("GET", path);
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.promise;
  const promise = request("GET", path).catch((e) => {
    cache.delete(path);
    throw e;
  });
  cache.set(path, { at: Date.now(), promise });
  return promise;
}

export const apiSend = (method, path, body) => request(method, path, body);
export const qs = (params) => new URLSearchParams(params).toString();
