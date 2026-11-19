// Artist details from sources other than Spotify, so an artist page costs no Spotify quota:
// Deezer (photo, fans, popular songs, discography, similar artists) through our /api/deezer proxy,
// and Wikipedia for a short bio. Spotify is only asked when the user plays or opens something.

const CACHE_KEY = "musify:artist-info:v1";
const CACHE_MS = 24 * 60 * 60_000;
const CACHE_MAX = 200;

function cached(key, load) {
  try {
    const hit = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}")[key];
    if (hit && Date.now() - hit.at < CACHE_MS) return Promise.resolve(hit.data);
  } catch {}
  return load().then((data) => {
    try {
      const all = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
      all[key] = { at: Date.now(), data };
      const kept = Object.entries(all)
        .sort((a, b) => b[1].at - a[1].at)
        .slice(0, CACHE_MAX);
      localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(kept)));
    } catch {} // full or blocked storage: just not cached
    return data;
  });
}

const fold = (s) => (s ?? "").normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

// The search result that is this artist: an exact (case- and accent-insensitive) name match, the one
// with the most fans if several share the name; else the top result.
export function pickArtist(results, name) {
  const exact = results.filter((a) => fold(a.name) === fold(name));
  return (exact.length ? exact.sort((a, b) => (b.nb_fan ?? 0) - (a.nb_fan ?? 0)) : results)[0] ?? null;
}

async function deezer(path, params = {}) {
  const res = await fetch(`/api/deezer/${path}?${new URLSearchParams(params)}`);
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.error) throw new Error(data?.error?.message ?? data?.error ?? `Deezer ${res.status}`);
  return data;
}

// -> { artist, top, albums, related } for an artist name, or null if Deezer doesn't know them.
export function artistBundle(name) {
  return cached(`deezer:${fold(name)}`, async () => {
    const found = pickArtist((await deezer("search/artist", { q: name, limit: 10 })).data ?? [], name);
    if (!found) return null;
    const [artist, top, albums, related] = await Promise.all([
      deezer(`artist/${found.id}`),
      deezer(`artist/${found.id}/top`, { limit: 10 }).then((d) => d.data ?? []),
      deezer(`artist/${found.id}/albums`, { limit: 100 }).then((d) => d.data ?? []),
      deezer(`artist/${found.id}/related`, { limit: 12 }).then((d) => d.data ?? []),
    ]);
    return { artist, top, albums, related };
  });
}

// Musicians' Wikipedia pages are usually "Name (band)" etc.; the summary's description tells us we
// found the musician and not a namesake.
const WIKI_TITLES = ["(band)", "(musician)", "(singer)", "(rapper)", "(group)", ""];
const MUSICAL = /band|musician|singer|rapper|songwriter|\bdj\b|producer|duo|group|composer|artist|vocalist/i;

export function wikiSummary(name) {
  return cached(`wiki:${fold(name)}`, async () => {
    for (const suffix of WIKI_TITLES) {
      const title = encodeURIComponent(`${name} ${suffix}`.trim().replace(/ /g, "_"));
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`).catch(() => null);
      if (!res?.ok) continue;
      const page = await res.json();
      if (page.type === "standard" && MUSICAL.test(page.description ?? "") && page.extract)
        return { extract: page.extract, description: page.description, url: page.content_urls?.desktop?.page };
    }
    return null;
  });
}

// A title as both services would agree on it: case, accents and featured-artist credits removed, but
// version tags kept ("Tom Tom (Slowed)" is not "Tom Tom").
export const songCore = (s) =>
  fold(s)
    .replace(/\s*[([](feat|ft|with)\b\.?[^)\]]*[)\]]/g, "")
    .replace(/\s+-\s+(feat|ft)\b\.?.*$/, "")
    .replace(/\s+/g, " ")
    .trim();

// Which of `rows` ({ title, duration } in seconds, Deezer) is the playing song ({ name, durationMs },
// Spotify): same core title, and when both lengths are known, within 3 seconds. One row at most,
// -1 if none.
export function playingRow(rows, playing) {
  if (!playing?.name) return -1;
  const title = songCore(playing.name);
  const seconds = playing.durationMs ? playing.durationMs / 1000 : null;
  return rows.findIndex(
    (r) => songCore(r.title) === title && (!seconds || !r.duration || Math.abs(r.duration - seconds) <= 3)
  );
}

// Deezer album record types -> our sections.
export function groupAlbums(albums) {
  const albumsOnly = albums.filter((a) => a.record_type === "album" || a.record_type === "compile");
  const singles = albums.filter((a) => a.record_type === "single" || a.record_type === "ep");
  const byDate = (a, b) => (b.release_date ?? "").localeCompare(a.release_date ?? "");
  return { albums: albumsOnly.sort(byDate), singles: singles.sort(byDate) };
}

export const formatFans = (n) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M fans` : n >= 1e3 ? `${Math.round(n / 1e3)}K fans` : `${n} fans`;
