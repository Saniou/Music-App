/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['i.scdn.co', 'thisis-images.scdn.co', 'seeded-session-images.scdn.co'],
  },
  async headers() {
    return [
      {
        source: '/',
        headers: [
          {
            key: 'middleware',
            value: '_middleware.js',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;