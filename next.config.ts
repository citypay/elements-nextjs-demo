import type { NextConfig } from 'next';
const config: NextConfig = {
  turbopack: { root: process.cwd() },
  // The published React wrapper does not survive Strict Mode's element effect replay.
  // See LIBRARY-NOTES.md. Session creation is still independently idempotent.
  reactStrictMode: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
          },
        ],
      },
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }] },
    ];
  },
};
export default config;
