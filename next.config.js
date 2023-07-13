/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    forceSwcTransforms: true,
  },
  images: {
    domains: ['i.scdn.co', 'thisis-images.scdn.co', 'seeded-session-images.scdn.co', 'seed-mix-image.spotifycdn.com', 'dailymix-images.scdn.co', 'mosaic.scdn.co'],
  },
  async headers() {
    return [
      {
        source: '/',
        headers: [
          {
            key: 'middleware',
            value: '/middleware.js',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;