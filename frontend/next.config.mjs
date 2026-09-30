const API_ORIGIN = (process.env.API_ORIGIN || 'http://localhost:4000').replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Proxy /api/* to the Express backend so the whole app is served from one
  // origin (lets a single tunnel, e.g. ngrok, expose both web and API).
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` }];
  },
};

export default nextConfig;
