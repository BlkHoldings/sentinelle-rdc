import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Static export for GitHub Pages deployment
  output: 'export',
  trailingSlash: true,

  // Project site is served at https://blkholdings.github.io/sentinelle-rdc/
  basePath: process.env.NODE_ENV === 'production' ? '/sentinelle-rdc' : '',

  // Maplibre GL ships as an ES module; Next.js must transpile it
  transpilePackages: ['maplibre-gl', 'react-map-gl'],

  // next/image cannot be optimized in static export
  images: { unoptimized: true },

  // Suppress ESLint during production builds (CI has dedicated lint step)
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
