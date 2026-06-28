import { withSentryConfig } from "@sentry/nextjs";
import bundleAnalyzer from "@next/bundle-analyzer";
import createNextIntlPlugin from "next-intl/plugin";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],

  /* Enable Turbopack (Next.js 16 default bundler) alongside legacy webpack config */
  turbopack: {
    root: process.cwd(),
  },

  /* Reduce barrel-import overhead for large packages */
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'framer-motion', 'three', '@react-three/drei', 'xstate', '@xstate/react'],
  },

  /* Type checking runs in CI before build */

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
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              /* script-src: no unsafe-eval (verified Three.js/R3F/Sentry don't use eval/Function).
                 unsafe-inline required for Next.js hydration + Sentry error boundary inline scripts.
                 R-17: TODO migrate to nonce-based CSP when Next.js supports it natively. */
              "script-src 'self' 'unsafe-inline' cdnjs.cloudflare.com 3Dmol.org",
              /* style-src: unsafe-inline required for React style={{}} prop and Next.js CSS-in-JS. */
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self'",
              "img-src 'self' data: blob: https: upload.wikimedia.org cellimagelibrary.org idr.openmicroscopy.org",
              /* connect-src: client-side fetch targets (SemanticSearch, Sentry, etc.).
                 Server-side proxied APIs (KEGG, AlphaFold, PubChem) don't need entries here. */
              "connect-src 'self' https://eutils.ncbi.nlm.nih.gov https://www.ebi.ac.uk https://api.semanticscholar.org https://api.openalex.org https://api.core.ac.uk https://europepmc.org https://doi.org https://nexus-bio-1-0.vercel.app https://nexus-bio.org https://*.turso.io *.sentry.io",
              "frame-src 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
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
