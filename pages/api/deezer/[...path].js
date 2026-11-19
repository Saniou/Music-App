// Read-only proxy to Deezer's public API, used for artist pages so they cost no Spotify quota.
// Deezer's API sends no CORS headers, so the browser can't call it directly. Only the few artist
// endpoints the page needs are allowed, with a whitelisted, length-capped query; responses are cached
// at the edge for a day.
const ALLOWED = [/^search\/artist$/, /^artist\/\d{1,15}$/, /^artist\/\d{1,15}\/(albums|top|related)$/];
const PARAMS = ["q", "limit", "index"];

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  const path = [].concat(req.query.path ?? []).join("/");
  if (!ALLOWED.some((re) => re.test(path))) return res.status(400).json({ error: "Unsupported path" });

  const params = new URLSearchParams();
  for (const key of PARAMS) {
    const value = req.query[key];
    if (typeof value === "string" && value.length) params.set(key, value.slice(0, 200));
  }

  try {
    const upstream = await fetch(`https://api.deezer.com/${path}?${params}`, { signal: AbortSignal.timeout(8000) });
    const data = await upstream.json();
    // Deezer reports errors as 200 + { error }; don't cache those for long.
    res.setHeader(
      "Cache-Control",
      upstream.ok && !data?.error ? "public, s-maxage=86400, stale-while-revalidate=604800" : "public, s-maxage=60"
    );
    return res.status(upstream.ok ? 200 : 502).json(data);
  } catch {
    return res.status(502).json({ error: "Deezer unreachable" });
  }
}
