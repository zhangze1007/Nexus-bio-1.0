import { withSentryConfig } from "@sentry/nextjs";
import bundleAnalyzer from "@next/bundle-analyzer";
import createNextIntlPlugin from "next-intl/plugin";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],

  /*
   * Type-checking and linting are enforced in CI (.github/workflows/ci.yml runs
   * `tsc --noEmit` and `biome check` as dedicated steps before the build), so we
   * skip them inside `next build`. Running the full-project type-checker inside
   * the build spawns a second memory-heavy process on top of the webpack/Sentry
   * compile, which OOM-kills the Vercel build container (8 GB) during the
   * "Linting and checking validity of types" phase. Skipping it here does NOT
   * reduce type safety — a type error still fails CI.
   */
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  /* Enable Turbopack (Next.js 16 default bundler) alongside legacy webpack config */
  turbopack: {
    root: process.cwd(),
  },

  /* Reduce barrel-import overhead for large packages */
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'framer-motion', 'three', '@react-three/drei', 'xstate', '@xstate/react'],
  },

  /* Prevent native modules from being bundled into client code */
  serverExternalPackages: ['better-sqlite3', 'highs'],

  /* Image optimization */
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  /* Compression */
  compress: true,

  /* React strict mode for better dev experience */
  reactStrictMode: true,

  /* Security + caching headers */
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          /* CSP is now set dynamically in middleware.ts with nonce-based script-src (R-17) */
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  webpack: (config) => {
    // JSON imports are natively supported in Next.js 15+
    // Removed redundant rule for cleaner configuration
    return config;
  },
};

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl(withSentryConfig(withBundleAnalyzer(nextConfig), {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
}));
