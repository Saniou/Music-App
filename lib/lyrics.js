// Lyrics from LRCLIB (lrclib.net): free, no key, CORS-enabled; it asks clients to identify themselves.
const LRCLIB = "https://lrclib.net/api";
const HEADERS = { "Lrclib-Client": "Musify/0.1" };

// "[01:02.50] line" -> [{ timeMs: 62500, text: "line" }], sorted. A line may carry several stamps
// (repeated choruses); metadata tags like [ar:...] have no time and are skipped.
export function parseLrc(lrc) {
  const lines = [];
  for (const raw of (lrc ?? "").split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d{1,2}(?:[.:]\d{1,3})?)\]/g)];
    if (!stamps.length) continue;
    const text = raw.slice(stamps.at(-1).index + stamps.at(-1)[0].length).trim();
    for (const [, min, sec] of stamps)
      lines.push({ timeMs: Math.round((Number(min) * 60 + Number(sec.replace(":", "."))) * 1000), text });
  }
  return lines.sort((a, b) => a.timeMs - b.timeMs);
}

// LRCLIB's word-synced "lyricsfile" (a small, fixed YAML shape):
//   lines:
//   - text: I'm not afraid
//     start_ms: 1500
//     end_ms: 2311
//     words:
//     - text: 'I''m '
//       start_ms: 1500
// -> [{ timeMs, endMs, text, words: [{ text, timeMs }] }]. Only this shape is read; anything else is
// skipped, and if no lines come out the caller falls back to the plain LRC timings.
export function parseWordSync(file) {
  const lines = [];
  let line = null;
  let word = null;
  for (const raw of (file ?? "").split(/\r?\n/)) {
    let m;
    if ((m = raw.match(/^- text: ?(.*)$/))) {
      line = { text: yamlString(m[1]), timeMs: 0, endMs: null, words: [] };
      word = null;
      lines.push(line);
    } else if (!line) continue;
    else if ((m = raw.match(/^ {2}start_ms: (\d+)/))) line.timeMs = Number(m[1]);
    else if ((m = raw.match(/^ {2}end_ms: (\d+)/))) line.endMs = Number(m[1]);
    else if ((m = raw.match(/^ {2}- text: ?(.*)$/))) line.words.push((word = { text: yamlString(m[1]), timeMs: 0 }));
    else if (word && (m = raw.match(/^ {4}start_ms: (\d+)/))) word.timeMs = Number(m[1]);
  }
  return lines.sort((a, b) => a.timeMs - b.timeMs);
}

function yamlString(s) {
  const t = s.trim();
  if (t.length >= 2 && t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1).replace(/''/g, "'"); // keeps 'word ' spaces
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    try {
      return JSON.parse(t);
    } catch {
      return t.slice(1, -1);
    }
  }
  return t;
}

// When each word ends: the next word's start, else the line's end, else the next line's start.
export function wordEnd(lines, lineIndex, wordIndex) {
  const line = lines[lineIndex];
  return line.words[wordIndex + 1]?.timeMs ?? line.endMs ?? lines[lineIndex + 1]?.timeMs ?? line.words[wordIndex].timeMs + 500;
}

// Index of the line being sung at positionMs (-1 before the first one). Binary search: called 4x a second.
export function activeLine(lines, positionMs) {
  let lo = 0;
  let hi = lines.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].timeMs <= positionMs) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

const cache = new Map(); // track uri -> Promise<result>

// -> { synced: [{timeMs, text}] | null, plain: string | null, instrumental: boolean }, or null if none.
export function fetchLyrics(track) {
  if (!track?.uri) return Promise.resolve(null);
  if (!cache.has(track.uri)) {
    const promise = lookup(track).catch((e) => {
      cache.delete(track.uri); // a network error shouldn't stick; "not found" (null) does
      throw e;
    });
    cache.set(track.uri, promise);
  }
  return cache.get(track.uri);
}

async function lookup(track) {
  const artist = track.artists?.[0]?.name ?? "";
  const seconds = Math.round((track.durationMs ?? 0) / 1000);
  const params = new URLSearchParams({ track_name: track.name, artist_name: artist });
  if (track.album?.name) params.set("album_name", track.album.name);
  if (seconds) params.set("duration", seconds);

  // Exact match first (LRCLIB allows ±2s on duration); else search and take the closest duration.
  let hit = null;
  const exact = await fetch(`${LRCLIB}/get?${params}`, { headers: HEADERS });
  if (exact.ok) hit = await exact.json();
  else if (exact.status === 404) {
    const res = await fetch(`${LRCLIB}/search?${new URLSearchParams({ track_name: track.name, artist_name: artist })}`, {
      headers: HEADERS,
    });
    if (!res.ok) throw new Error(`LRCLIB search ${res.status}`);
    const results = await res.json();
    hit =
      results
        .filter((r) => !seconds || Math.abs(r.duration - seconds) <= 5) // another version of the song is worse than none
        .sort((a, b) => !!b.syncedLyrics - !!a.syncedLyrics || Math.abs(a.duration - seconds) - Math.abs(b.duration - seconds))[0] ??
      null;
  } else throw new Error(`LRCLIB ${exact.status}`);

  if (!hit) return null;
  // Word timings when LRCLIB has them (karaoke), else line timings.
  const words = hit.hasWordSync && hit.lyricsfile ? parseWordSync(hit.lyricsfile).filter((l) => l.words.length) : [];
  const synced = words.length ? words : hit.syncedLyrics ? parseLrc(hit.syncedLyrics) : null;
  return {
    synced: synced?.length ? synced : null,
    plain: hit.plainLyrics || null,
    instrumental: !!hit.instrumental,
  };
}
