/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  experimental: {
    outputFileTracingIncludes: {
      'app/api/scan/route': ['node_modules/@sparticuz/chromium/**'],
    },
  },
};

module.exports = nextConfig;
