/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Add rule for Playwright font files
    config.module.rules.push({
      test: /\.(ttf|woff|woff2|eot)$/,
      type: 'asset/resource',
    });
    return config;
  },
  // Moved key: specify external packages that must be bundled on the server
  serverExternalPackages: ['playwright-core'],
  experimental: {
    typedRoutes: false, // Enable dtyped routes (keep this experimental flag)
  },
  // Environment variables loading
  env: {
    MONGODB_URI: process.env.MONGODB_URI,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  // Bypass TypeScript errors during production build
  typescript: {
    ignoreBuildErrors: true,
  },
  // Bypass ESLint errors during production build
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable source maps in production
  productionBrowserSourceMaps: false,
  // Remove the X-Powered-By header
  poweredByHeader: false,
};

module.exports = nextConfig; 