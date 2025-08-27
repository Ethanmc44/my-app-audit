/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  experimental: {
    serverComponentsExternalPackages: ['@sparticuz/chromium'],
    outputFileTracingIncludes: {
      'app/api/scan/route': ['node_modules/@sparticuz/chromium/**']
    }
  }
};
module.exports = nextConfig;
