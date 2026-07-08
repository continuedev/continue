/**
 * Extracts content from code blocks with given path
 * @param content The full message content
 * @param path The file path to look for
 * @returns The content of the code block if found, undefined otherwise
 */
export function extractContentFromCodeBlock(
  content: string,
  path: string,
): string | undefined {
  // Escape special characters in the path for regex
  const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Match the code block with this path
  // This regex looks for:
  // 1. Code block start with the path (```[language] path)
  // 2. The content until the closing ```
  // The path can be:
  //   - With language: ```typescript src/main.ts
  //   - Without language: ```src/main.ts
  //   - With line ranges: ```js src/main.ts (1-10)
  const regex = new RegExp(
    `\`\`\`[^\\n]*\\b${escapedPath}(?:\\s+\\([\\d-]+\\))?[^\\n]*\\n([\\s\\S]*?)\\n\`\`\``,
    "m",
  );

  const match = content.match(regex);
  if (match && match[1]) {
    return match[1];
  }

  return undefined;
}
