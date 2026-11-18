/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    forceSwcTransforms: true,
  },
  images: {
    // Spotify's CDN already serves covers at 64/300/640px (picked via coverUrl). Next's optimizer
    // without `sharp` falls back to squoosh, which ignores CMYK/ICC profiles and washes covers out.
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: '**.scdn.co' },
      { protocol: 'https', hostname: '**.spotifycdn.com' },
    ],
  },
};

module.exports = nextConfig;