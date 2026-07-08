/** @type {import('next').NextConfig} */

// When deploying to GitHub Pages the site is served from the `/continue/`
// subpath (https://continuedev.github.io/continue/). GitHub Actions sets
// GITHUB_ACTIONS=true, so we only apply the base path there — local dev
// (localhost:3005) keeps serving from the root.
const isGithubPages = process.env.GITHUB_ACTIONS === "true";
const basePath = isGithubPages ? "/continue" : "";

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
