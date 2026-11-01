/**
 * Base path for the deployed docs site.
 *
 * On GitHub Pages the site lives under `/continue/`, so raw absolute asset
 * references (search index, <img> src, etc.) must be prefixed manually. Next
 * applies basePath automatically to <Link>, next/image and /_next assets, but
 * NOT to plain string paths, so use `withBasePath` for those.
 *
 * `NEXT_PUBLIC_BASE_PATH` is inlined at build time (see next.config.js) and is
 * therefore safe to read in both server and client/browser code.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** Prefix an absolute (`/`-rooted) path with the deploy base path. */
export function withBasePath(path: string): string {
  if (!path.startsWith("/")) return path;
  return `${BASE_PATH}${path}`;
}
