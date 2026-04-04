/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  turbopack: {},
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
