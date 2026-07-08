import crypto from "crypto";
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
 * 2. If too long, truncates directory from the beginning and adds a hash prefix
 *    to ensure uniqueness while preserving the more readable end parts
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

  // Create a hash of the full directory path to ensure uniqueness
  const dirHash = crypto
    .createHash("md5")
    .update(tag.directory)
    .digest("hex")
    .slice(0, 8);

  // Calculate how much space we have for the directory after accounting for hash, separators, branch, and artifactId
  const nonDirLength = `${dirHash}_::${tag.branch}::${tag.artifactId}`.length;
  const maxDirForTruncated = MAX_TABLE_NAME_LENGTH - nonDirLength;

  // Truncate from the beginning of directory path to preserve the more unique end parts
  const truncatedDir =
    tag.directory.length > maxDirForTruncated
      ? tag.directory.slice(tag.directory.length - maxDirForTruncated)
      : tag.directory;

  return `${dirHash}_${truncatedDir}::${tag.branch}::${tag.artifactId}`;
}
