import { myersDiff } from "core/diff/myers";

/**
 * Creates a pretty patch diff string similar to unified diff format
 * Uses Continue's existing myersDiff function for diff calculation
 */
export function createPrettyPatch(
  filename: string = "file",
  oldStr: string = "",
  newStr: string = "",
): string {
  if (oldStr === newStr) {
    return "";
  }

  const diffLines = myersDiff(oldStr, newStr);
  const patchLines: string[] = [];

  for (const diffLine of diffLines) {
    switch (diffLine.type) {
      case "old":
        patchLines.push(`-${diffLine.line}`);
        break;
      case "new":
        patchLines.push(`+${diffLine.line}`);
        break;
      case "same":
        patchLines.push(` ${diffLine.line}`);
        break;
    }
  }

  return patchLines.join("\n");
}

/**
 * Normalizes content by trimming whitespace for comparison
 */
export function normalizeContent(content: string): string {
  return content.trim();
}