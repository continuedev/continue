/** @type {import('next').NextConfig} */

// GitHub Pages serves a project site under /<repo>/; set DOCS_BASE_PATH when
// building for it. No custom domain is configured (there is no public/CNAME).
const basePath = process.env.DOCS_BASE_PATH ?? "";

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
