/** @type {import('next').NextConfig} */
module.exports = {
  // Transpile BullMQ and ioredis for proper webpack bundling
  transpilePackages: ['bullmq', 'ioredis'],

  // Mark Node.js-only packages as external for API routes
  experimental: {
    serverComponentsExternalPackages: ['bullmq', 'ioredis'],
  },

  async headers() {
    const allowedOrigin = process.env.ALLOWED_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: allowedOrigin,
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true',
          },
        ],
      },
    ];
  },
};
