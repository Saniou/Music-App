// Sign-in only works on the host NEXTAUTH_URL names: NextAuth's OAuth state cookie is per host, and
// Spotify redirects back to NEXTAUTH_URL. Starting on another alias of the same deployment (Vercel's
// per-deploy or git-branch URLs, or localhost vs 127.0.0.1) loses that cookie and the first sign-in
// bounces back to /login. Send such visitors to the canonical host before they start.
export function canonicalRedirect({ req, resolvedUrl }) {
  if (!process.env.NEXTAUTH_URL) return null;
  const canonical = new URL(process.env.NEXTAUTH_URL);
  const host = req.headers["x-forwarded-host"] ?? req.headers.host;
  if (!host || host === canonical.host) return null;
  // resolvedUrl, not req.url: on client-side navigation req.url is the /_next/data/... JSON path.
  return { redirect: { destination: canonical.origin + resolvedUrl, permanent: false } };
}
