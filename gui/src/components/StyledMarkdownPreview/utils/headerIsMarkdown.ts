/**
 * Determines if a given header string represents Markdown content.
 *
 * The function checks various patterns to identify Markdown headers:
 * - Exact match with common Markdown identifiers (md, markdown, gfm, github-markdown)
 * - Contains these identifiers preceded by a space
 * - First word has a file extension of md, markdown, or gfm
 *
 * @param header - The string to check for Markdown indicators
 * @returns True if the header represents Markdown content, false otherwise
 */
export function headerIsMarkdown(header: string): boolean {
  return (
    header === "md" ||
    header === "markdown" ||
    header === "gfm" ||
    header === "github-markdown" ||
    header.includes(" md") ||
    header.includes(" markdown") ||
    header.includes(" gfm") ||
    header.includes(" github-markdown") ||
    header.split(" ")[0]?.split(".").pop() === "md" ||
    header.split(" ")[0]?.split(".").pop() === "markdown" ||
    header.split(" ")[0]?.split(".").pop() === "gfm"
  );
}
