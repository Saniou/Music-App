// Our own listening log: Spotify only returns the last 50 plays, so we record what plays here.
// Entry: { uri, name, artists: [{ id, name }], cover, ms, at } (ms listened, at = start time).
// Pure helpers; storage lives in the store.

export const MIN_LISTEN_MS = 30_000; // shorter than this isn't a play (Spotify counts 30s too)
export const HISTORY_CAP = 5000; // ~1 MB of localStorage

const DAY = 86_400_000;
const startOfDay = (t) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

// The last 7 days (today last): total listening, plays, minutes per day, top artists and tracks by time.
export function weekStats(history, now = Date.now()) {
  const from = startOfDay(now) - 6 * DAY;
  const days = Array.from({ length: 7 }, (_, i) => ({ start: from + i * DAY, ms: 0 }));
  const artists = new Map();
  const tracks = new Map();
  let totalMs = 0;
  let plays = 0;
  for (const e of history) {
    if (e.at < from || e.at > now) continue;
    totalMs += e.ms;
    plays++;
    days[Math.min(6, Math.floor((startOfDay(e.at) - from) / DAY))].ms += e.ms;
    for (const a of e.artists ?? []) {
      const key = a.id ?? a.name;
      const cur = artists.get(key) ?? { id: a.id, name: a.name, ms: 0 };
      cur.ms += e.ms;
      artists.set(key, cur);
    }
    const t = tracks.get(e.uri) ?? { uri: e.uri, name: e.name, artists: e.artists, cover: e.cover, ms: 0, plays: 0 };
    t.ms += e.ms;
    t.plays++;
    tracks.set(e.uri, t);
  }
  const byMs = (a, b) => b.ms - a.ms;
  return {
    totalMs,
    plays,
    days,
    topArtists: [...artists.values()].sort(byMs).slice(0, 5),
    topTracks: [...tracks.values()].sort(byMs).slice(0, 5),
  };
}

export const formatListening = (ms) => {
  const min = Math.round(ms / 60_000);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
};
