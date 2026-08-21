/**
 * Extracts file paths from markdown code blocks
 */
export function extractPathsFromCodeBlocks(content: string): string[] {
  const paths: string[] = [];

  // Match code block opening patterns:
  // 1. ```language filepath
  // 2. ```filepath
  // 3. ```language filepath (range)

  // First match all code block starts
  const codeBlockStarts = content.match(/```[^\n]+/g) || [];

  for (const blockStart of codeBlockStarts) {
    const path = extractPathFromCodeBlockStart(blockStart);

    // Verify this is a legitimate path (not part of something else)
    if (
      path &&
      // Check if valid extension
      /\.[a-zA-Z0-9]+$/.test(path) &&
      // Make sure it's not a URL
      !path.includes("://") &&
      // Avoid duplicates
      !paths.includes(path)
    ) {
      paths.push(path);
    }
  }
  return paths;
}

/**
 * Extracts the file path from a single code block opening line, e.g.
 * "```typescript src/main.ts (1-10)" -> "src/main.ts".
 *
 * The opening line can take any of these shapes:
 *   ```<lang> <path>
 *   ```<path>
 *   ```<lang> <path> (<start>-<end>)
 *
 * The path itself may contain spaces, so we only use spaces to split the
 * optional language tag from the path.
 */
function extractPathFromCodeBlockStart(blockStart: string): string | undefined {
  let path = blockStart
    .replace(/^`+/, "")
    // Drop a trailing line range, e.g. " (1-10)"
    .replace(/\s+\([\d-]+\)$/, "")
    .trim();

  if (!path) return undefined;

  // A leading language tag (e.g. "typescript", "md") is a single token with
  // no path separators. Anything containing "/" or "\" must be part of the
  // path so that paths with spaces (e.g. "docs/foo bar.md") survive intact.
  const firstSpaceIndex = path.search(/\s/);
  if (firstSpaceIndex !== -1) {
    const firstToken = path.slice(0, firstSpaceIndex);
    if (!firstToken.includes("/") && !firstToken.includes("\\")) {
      path = path.slice(firstSpaceIndex + 1).trim();
    }
  }

  return path || undefined;
}
