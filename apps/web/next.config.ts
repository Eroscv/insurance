import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@insurance/shared'],
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
