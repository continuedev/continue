/**
 * Extracts file paths from markdown code blocks
 */
export function extractPathsFromCodeBlocks(content: string): string[] {
  const codeBlockRegex = /```[\w-+#]*\s+([^\s(]+)(?:\s|$|\()/g;
  const paths: string[] = [];
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match[1]) {
      paths.push(match[1]);
    }
  }

  return paths;
}
