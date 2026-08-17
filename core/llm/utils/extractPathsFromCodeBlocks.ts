/**
 * Extracts the file path from a single code block opening line, e.g.
 * "```typescript src/main.ts (1-10)" -> "src/main.ts"
 */
function extractPathFromCodeBlockStart(blockStart: string): string | undefined {
  let path = blockStart
    .replace(/^`+/, "")
    // Drop a trailing line range, e.g. " (1-10)"
    .replace(/\s+\([\d-]+\)$/, "")
    .trim();

  // A leading language tag can only be told apart from the path itself when it
  // has no path characters, e.g. "```md docs/my file.md" but not "```my file.md"
  const firstSpaceIndex = path.search(/\s/);
  if (firstSpaceIndex !== -1) {
    const firstToken = path.slice(0, firstSpaceIndex);
    if (!/[./\\]/.test(firstToken)) {
      path = path.slice(firstSpaceIndex + 1).trim();
    }
  }

  const isValidPath =
    // Check if valid extension
    /\.[a-zA-Z0-9]+$/.test(path) &&
    // Make sure it's not a URL
    !path.includes("://") &&
    !path.includes("`");

  return isValidPath ? path : undefined;
}

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

    // Avoid duplicates
    if (path && !paths.includes(path)) {
      paths.push(path);
    }
  }
  return paths;
}
