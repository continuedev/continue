/**
 * URI utility functions for auth config
 */

export function pathToUri(path: string): string {
  return `file://${path}`;
}

export function slugToUri(slug: string): string {
  return `slug://${slug}`;
}

export function uriToPath(uri: string): string | null {
  if (!uri.startsWith("file://")) {
    return null;
  }
  return uri.slice(7);
}

export function uriToSlug(uri: string): string | null {
  if (!uri.startsWith("slug://")) {
    return null;
  }
  return uri.slice(7);
}
