import { IndexTag } from "..";

// Maximum length for table names to stay under OS filename limits
const MAX_TABLE_NAME_LENGTH = 240;

// Leave room for branch and artifactId
const MAX_DIR_LENGTH = 200;

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
 * 1. First tries the full string - most backwards compatible
 * 2. If too long, truncates directory from the beginning to maintain uniqueness
 *    (since final parts of paths are more unique than prefixes)
 * 3. Finally ensures entire string stays under MAX_TABLE_NAME_LENGTH for OS compatibility
 *
 * @param tag The tag containing directory, branch, and artifactId
 * @returns A string representation safe for use as a table name
 */
export function tagToString(tag: IndexTag): string {
  const result = `${tag.directory}::${tag.branch}::${tag.artifactId}`;

  if (result.length <= MAX_TABLE_NAME_LENGTH) {
    return result;
  }

  // Truncate from the beginning of directory path to preserve the more unique end parts
  const dir =
    tag.directory.length > MAX_DIR_LENGTH
      ? tag.directory.slice(tag.directory.length - MAX_DIR_LENGTH)
      : tag.directory;

  return `${dir}::${tag.branch}::${tag.artifactId}`.slice(
    0,
    MAX_TABLE_NAME_LENGTH,
  );
}
