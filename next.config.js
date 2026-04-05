/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  /* Enable Turbopack (Next.js 16 default bundler) alongside legacy webpack config */
  turbopack: {
    root: __dirname,
  },
  webpack: (config) => {
    // Ensure .json imports work correctly
    config.module.rules.push({
      test: /\.json$/,
      type: 'json',
    });
    return config;
  },
};

module.exports = nextConfig;
