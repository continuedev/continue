/**
 * Resolve internal paths for the standalone docs app.
 *
 * Pages link to /docs/X; the site serves them at /X. Callers that render a
 * plain <a> add the deploy base path (see MdxLink).
 */
export function resolveHref(path: string): string {
  // Strip /docs prefix — we're already on the docs domain
  if (path.startsWith("/docs/")) return path.slice(5);
  if (path === "/docs") return "/";

  // Everything else stays as-is
  return path;
}
