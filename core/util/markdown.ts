/**
 * Removes code blocks from a message.
 *
 * Return modified message text.
 */
export function removeCodeBlocksAndTrim(text: string): string {
  const codeBlockRegex = /```[\s\S]*?```/g;

  // Remove code blocks from the message text
  const textWithoutCodeBlocks = text.replace(codeBlockRegex, "");

  return textWithoutCodeBlocks.trim();
}
