import { IndexTag } from "..";

/**
 * Converts an IndexTag to a string representation, safely handling long paths.
 *
 * The string is used as a table name and identifier in various places, so it needs
 * to stay under OS filename length limits (typically 255 chars). This is especially
 * important for dev containers where the directory path can be very long due to
 * containing container configuration.
 *
 * The format is: "{directory}::{branch}::{artifactId}"
 *
 * To handle long paths:
 * 1. First truncates directory to 200 chars to leave room for branch and artifactId
 * 2. Then ensures entire string stays under 240 chars for OS compatibility
 *
 * @param tag The tag containing directory, branch, and artifactId
 * @returns A string representation safe for use as a table name
 */
export function tagToString(tag: IndexTag): string {
  const maxDirLength = 200; // Leave room for branch and artifactId
  const dir =
    tag.directory.length > maxDirLength
      ? tag.directory.slice(0, maxDirLength)
      : tag.directory;

  const result = `${dir}::${tag.branch}::${tag.artifactId}`;
  return result.slice(0, 240); // Ensure final string is not too long
}
