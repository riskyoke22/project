import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Hanya aktifkan output standalone saat di Docker/CI (Linux) atau ditentukan eksplisit,
  // untuk menghindari pembatasan pembuatan symlink Windows (EPERM) di laptop lokal pengembang.
  ...(process.env.BUILD_STANDALONE === 'true' ? { output: 'standalone' } : {}),
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
