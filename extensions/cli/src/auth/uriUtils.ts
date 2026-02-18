import { normalize } from "path";
import { fileURLToPath, pathToFileURL } from "url";

/**
 * URI utility functions for auth config
 */

export function pathToUri(path: string): string {
  const normalizedPath = normalize(path);
  return pathToFileURL(normalizedPath).href;
}

export function slugToUri(slug: string): string {
  return `slug://${slug}`;
}

export function uriToPath(uri: string): string | null {
  if (!uri.startsWith("file://")) {
    return null;
  }
  try {
    return fileURLToPath(uri);
  } catch {
    return null;
  }
}

export function uriToSlug(uri: string): string | null {
  if (!uri.startsWith("slug://")) {
    return null;
  }
  return uri.slice(7);
}
