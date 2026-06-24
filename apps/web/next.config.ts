import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
      // sodium-native is a Node.js native addon — stub it in the browser bundle
      config.externals = [...(config.externals ?? []), 'sodium-native'];
    }
    return config;
  },
};

export default nextConfig;
