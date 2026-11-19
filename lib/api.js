import { spotifyApi } from "@/hooks/useSpotify";

// Direct Web API calls. spotify-web-api-node predates the Feb 2026 Dev Mode endpoints
// (/playlists/{id}/items, /me/library, reading the queue), so newer calls go through here.

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
  const maxRetries = method === "GET" ? BACKOFF_STEPS_MS.length : 1;
  if (res.status === 429 && attempt < maxRetries) {
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

export function apiGet(path) {
  if (!cacheable(path)) return request("GET", path);
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
export const qs = (params) => new URLSearchParams(params).toString();
