/** @type {import('next').NextConfig} */

// Served at the root of the custom domain docs.continue.dev (via GitHub Pages),
// so there is no base path. (public/CNAME sets the custom domain.)
const basePath = "";

const nextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  // Expose the base path to client/runtime code so raw string asset paths
  // (search index fetch, <img> src, etc.) can be prefixed manually — Next only
  // applies basePath automatically to <Link>, next/image and /_next assets.
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
