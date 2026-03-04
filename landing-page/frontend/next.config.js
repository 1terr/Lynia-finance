/* eslint-disable @typescript-eslint/no-var-requires */
const withBundleAnalyzer = process.env.ANALYZE === 'true'
  ? require('@next/bundle-analyzer')({ enabled: true })
  : (/** @type {import('next').NextConfig} */ cfg) => cfg;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

module.exports = withBundleAnalyzer(nextConfig);
