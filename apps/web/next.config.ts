import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // output: 'standalone',  // enable only for Docker self-hosting, not Vercel
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.githubusercontent.com' },
      { protocol: 'https', hostname: 'pbs.twimg.com' },
      { protocol: 'https', hostname: 'unavatar.io' },
    ],
  },
  experimental: {
    turbo: {},
  },
  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    // sodium-native is a Node.js native addon — alias it to an empty stub for the browser
    config.resolve.alias = {
      ...config.resolve.alias,
      'sodium-native': false,
    };
    return config;
  },
};

export default nextConfig;
