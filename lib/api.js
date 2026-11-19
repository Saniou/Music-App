import { spotifyAuth } from "@/hooks/useSpotify";
import { bucketOf } from "@/lib/playback";

// All Spotify Web API calls go through here (plain fetch; the old spotify-web-api-node client was
// abandoned and predates the Feb 2026 Dev Mode endpoints).

// Dev Mode's rate limit is small and shared by the whole developer account. On a 429 every call
// waits the backoff out together instead of hammering, then the failed call retries by itself.
// Spotify's Retry-After isn't always readable from the browser (CORS), so without it we step up:
// 3s, 8s, 15s, 30s. Reads retry that far; commands (play, seek...) once, since a late one is stale.
const BACKOFF_STEPS_MS = [3000, 8000, 15000, 30000];
const MAX_BACKOFF_MS = 30_000;
let pausedUntil = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const isRateLimited = () => Date.now() < pausedUntil;
export function backOff(retryAfterSeconds, attempt = 0) {
  const s = Number(retryAfterSeconds);
  const ms = Number.isFinite(s) && s > 0 ? s * 1000 : BACKOFF_STEPS_MS[Math.min(attempt, BACKOFF_STEPS_MS.length - 1)];
  pausedUntil = Math.max(pausedUntil, Date.now() + Math.min(ms, MAX_BACKOFF_MS));
}

// The Dev Mode quota is a different wall from the 30s rate limit: a 429 whose body says
// reason QUOTA_EXCEEDED. Retrying only spends more of it, so reads stop at once and fail fast for a
// while (Retry-After if Spotify gives one we can read, else 5 minutes); commands the user asks for
// still go through. Spotify doesn't publish the window or a reset time.
// Quotas come in buckets of endpoints ("subject to change", unpublished), so we track them per area:
// running out of artist/album reads must not stop following the player, or a new song never shows.
const QUOTA_PAUSE_MS = 5 * 60_000;
export { bucketOf }; // which area a path's quota belongs to (lib/playback, tested there)
const quotaUntil = {};
export const isQuotaExceeded = (bucket) => Date.now() < (quotaUntil[bucket] ?? 0);
export const isQuotaError = (e) => e?.statusCode === 429 && e?.body?.error?.reason === "QUOTA_EXCEEDED";
export function markQuotaExceeded(bucket, retryAfterSeconds) {
  const s = Number(retryAfterSeconds);
  const until = Date.now() + (Number.isFinite(s) && s > 0 ? s * 1000 : QUOTA_PAUSE_MS);
  quotaUntil[bucket] = Math.max(quotaUntil[bucket] ?? 0, until);
}
const QUOTA_ERROR = { statusCode: 429, body: { error: { status: 429, reason: "QUOTA_EXCEEDED" } } };

// retry: false for polls, which come round again anyway (a 429 still sets the shared backoff).
async function request(method, path, body, attempt = 0, retry = true) {
  const bucket = bucketOf(path);
  if (method === "GET" && isQuotaExceeded(bucket)) throw QUOTA_ERROR;
  const wait = pausedUntil - Date.now();
  if (wait > 0) await sleep(wait);
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${spotifyAuth.getAccessToken()}`,
      ...(body && { "Content-Type": "application/json" }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  const text = await res.text(); // 204s and some PUTs have no body
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}
  const error = { statusCode: res.status, body: data };
  if (isQuotaError(error)) {
    markQuotaExceeded(bucket, res.headers.get("Retry-After"));
    throw error; // no retry: it would only spend more quota
  }
  const maxRetries = !retry ? 0 : method === "GET" ? BACKOFF_STEPS_MS.length : 1;
  if (res.status === 429) {
    backOff(res.headers.get("Retry-After"), attempt);
    if (attempt < maxRetries) return request(method, path, body, attempt + 1, retry);
  }
  if (!res.ok) throw error;
  return data;
}

// Artists and albums barely change: keep them a day, in memory and in this browser, so revisiting
// an artist (even after a reload) costs no requests. Failures aren't kept.
const CACHE_MS = 24 * 60 * 60_000;
const CACHE_KEY = "musify:api-cache:v1";
const CACHE_MAX = 150; // entries; artist/album responses are a few KB each
const cacheable = (path) => /^\/(artists|albums)\//.test(path);
const memory = new Map(); // path -> Promise

function readStored() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) ?? {};
  } catch {
    return {};
  }
}
function store(path, data) {
  try {
    const all = readStored();
    all[path] = { at: Date.now(), data };
    // Keep the newest CACHE_MAX.
    const kept = Object.entries(all)
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, CACHE_MAX);
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {} // full or blocked storage: memory still works
}

export function apiGet(path, { retry = true } = {}) {
  if (!cacheable(path)) return request("GET", path, undefined, 0, retry);
  if (memory.has(path)) return memory.get(path);
  const saved = readStored()[path];
  if (saved && Date.now() - saved.at < CACHE_MS) {
    const hit = Promise.resolve(saved.data);
    memory.set(path, hit);
    return hit;
  }
  const promise = request("GET", path).then(
    (data) => {
      store(path, data);
      return data;
    },
    (e) => {
      memory.delete(path);
      throw e;
    }
  );
  memory.set(path, promise);
  return promise;
}

export const apiSend = (method, path, body) => request(method, path, body);

// Player commands and state (https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback etc.).
const withDevice = (path, device_id) => (device_id ? `${path}?${new URLSearchParams({ device_id })}` : path);
export const player = {
  // { device_id?, uris?, context_uri?, offset?, position_ms? }; no body resumes what was playing
  play: ({ device_id, ...body } = {}) =>
    apiSend("PUT", withDevice("/me/player/play", device_id), Object.keys(body).length ? body : undefined),
  pause: () => apiSend("PUT", "/me/player/pause"),
  next: () => apiSend("POST", "/me/player/next"),
  previous: () => apiSend("POST", "/me/player/previous"),
  seek: (positionMs) => apiSend("PUT", `/me/player/seek?${new URLSearchParams({ position_ms: Math.round(positionMs) })}`),
  volume: (percent) => apiSend("PUT", `/me/player/volume?${new URLSearchParams({ volume_percent: Math.round(percent) })}`),
  shuffle: (state) => apiSend("PUT", `/me/player/shuffle?${new URLSearchParams({ state })}`),
  repeat: (state) => apiSend("PUT", `/me/player/repeat?${new URLSearchParams({ state })}`),
  state: () => apiGet("/me/player", { retry: false }), // null when nothing plays (204)
};
export const qs = (params) => new URLSearchParams(params).toString();
