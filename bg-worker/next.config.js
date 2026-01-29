const path = require('path');

/** @type {import('next').NextConfig} */
module.exports = {
  // Mark Node.js-only packages as external for server-side code
  // Use experimental.serverComponentsExternalPackages for Next.js 14.x
  experimental: {
    serverComponentsExternalPackages: ['bullmq', 'ioredis'],
  },

  // Explicit webpack alias for @ path resolution
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname);
    return config;
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
