/**
 * Extracts file paths from markdown code blocks
 */
export function extractPathsFromCodeBlocks(content: string): string[] {
  // Match:
  // 1. Starting ```
  // 2. Optional language identifier
  // 3. Required whitespace
  // 4. File path (captured) that must contain a dot and extension
  const codeBlockRegex = /```(?:[\w-+#]+)?\s+([^\s\n()]+\.[a-zA-Z0-9]+)/g;
  const paths: string[] = [];
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const path = match[1];
    if (path && !path.startsWith("```")) {
      paths.push(path);
    }
  }

  return paths;
}
