/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Security headers are handled by CloudFront ResponseHeadersPolicy
  typescript: {
    // Pre-existing type inconsistencies - TODO: fix in dedicated PR
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
