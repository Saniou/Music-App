// Pure playback helpers. No imports, so `npm run check` runs them in plain Node.

export const REPEAT_MODES = ["off", "context", "track"];
export const nextRepeat = (mode) =>
  REPEAT_MODES[(REPEAT_MODES.indexOf(mode) + 1) % REPEAT_MODES.length];

// Web API items and Web Playback SDK tracks differ slightly; make them one shape.
export function normalizeTrack(t) {
  if (!t?.uri) return null;
  return {
    id: t.id ?? null,
    uri: t.uri,
    linkedUri: t.linked_from?.uri ?? null, // set when Spotify relinked the track for the user's market
    name: t.name ?? "",
    artists: t.artists ?? [],
    album: t.album ?? {},
    durationMs: t.duration_ms ?? null,
    url: t.external_urls?.spotify ?? (t.id ? `https://open.spotify.com/track/${t.id}` : null),
  };
}

export const indexOfTrack = (tracks, t) =>
  t ? tracks.findIndex((x) => x.uri === t.uri || x.uri === t.linkedUri || (t.id && x.id === t.id)) : -1;

// Spotify reports position at a moment; extrapolate between reports instead of polling every second.
export function currentPosition({ isPlaying, positionMs, positionAt, durationMs }, now = Date.now()) {
  if (!isPlaying) return positionMs;
  const pos = positionMs + Math.max(0, now - positionAt);
  return durationMs ? Math.min(pos, durationMs) : pos;
}

export function explainError(e) {
  const reason = e?.body?.error?.reason;
  if (reason === "NO_ACTIVE_DEVICE" || e?.statusCode === 404)
    return "No active Spotify device. Open Spotify somewhere, or wait for the web player to connect.";
  if (reason === "PREMIUM_REQUIRED" || e?.statusCode === 403)
    return "Controlling playback needs Spotify Premium.";
  if (e?.statusCode === 401) return "Your Spotify session expired. Sign out and sign in again.";
  if (e?.statusCode === 429) return "Spotify is rate limiting us. Try again in a moment.";
  return "Spotify didn’t accept that. Try again.";
}

// Spotify lists each image in a few sizes, widest first; take the smallest that is still sharp at `px`.
export function coverUrl(images, px) {
  if (!images?.length) return null;
  const fit = images.filter((i) => i.width && i.width >= px).sort((a, b) => a.width - b.width)[0];
  return (fit ?? images[0]).url;
}

// "light" if most opaque pixels are light (relative luminance > 0.5), else "dark". rgba = ImageData.data.
export function majorityTone(rgba) {
  let light = 0;
  let counted = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue; // transparent pixels say nothing about the cover
    if ((0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2]) / 255 > 0.5) light++;
    counted++;
  }
  return counted && light * 2 >= counted ? "light" : "dark";
}

// Case- and accent-insensitive; every word must appear in the title, artists or album.
const fold = (s) => (s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
export function matchesQuery(track, query) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fold(`${track.name} ${track.artists.map((a) => a.name).join(" ")} ${track.album?.name ?? ""}`);
  return words.every((w) => hay.includes(w));
}

export const formatTime = (ms) => {
  const s = Math.max(0, Math.floor((ms || 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
