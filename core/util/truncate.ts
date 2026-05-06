import { getGraphemeSegmenter } from "./intl.js";

/**
 * Approximate terminal display width for a grapheme.
 * Wide CJK and emoji graphemes count as 2 columns.
 */
function graphemeWidth(grapheme: string): number {
  // Common emoji presentation chars and variation sequences.
  if (
    /\p{Extended_Pictographic}/u.test(grapheme) ||
    grapheme.includes("\uFE0F")
  ) {
    return 2;
  }

  const codePoint = grapheme.codePointAt(0);
  if (codePoint === undefined) return 0;

  // Approximate East Asian wide/full-width ranges.
  if (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6)
  ) {
    return 2;
  }

  return 1;
}

function stringWidth(text: string): number {
  let width = 0;
  for (const { segment } of getGraphemeSegmenter().segment(text)) {
    width += graphemeWidth(segment);
  }
  return width;
}

export function truncateToWidth(text: string, maxWidth: number): string {
  if (stringWidth(text) <= maxWidth) return text;
  if (maxWidth <= 1) return "…";

  let width = 0;
  let result = "";
  for (const { segment } of getGraphemeSegmenter().segment(text)) {
    const segWidth = graphemeWidth(segment);
    if (width + segWidth > maxWidth - 1) break;
    result += segment;
    width += segWidth;
  }

  return `${result}…`;
}

export function truncateStartToWidth(text: string, maxWidth: number): string {
  if (stringWidth(text) <= maxWidth) return text;
  if (maxWidth <= 1) return "…";

  const segments = [...getGraphemeSegmenter().segment(text)];
  let width = 0;
  let startIndex = segments.length;

  for (let i = segments.length - 1; i >= 0; i--) {
    const segWidth = graphemeWidth(segments[i].segment);
    if (width + segWidth > maxWidth - 1) break;
    width += segWidth;
    startIndex = i;
  }

  return (
    "…" +
    segments
      .slice(startIndex)
      .map((segment) => segment.segment)
      .join("")
  );
}

export function truncateToWidthNoEllipsis(
  text: string,
  maxWidth: number,
): string {
  if (stringWidth(text) <= maxWidth) return text;
  if (maxWidth <= 0) return "";

  let width = 0;
  let result = "";
  for (const { segment } of getGraphemeSegmenter().segment(text)) {
    const segWidth = graphemeWidth(segment);
    if (width + segWidth > maxWidth) break;
    result += segment;
    width += segWidth;
  }
  return result;
}

export function truncatePathMiddle(path: string, maxLength: number): string {
  if (stringWidth(path) <= maxLength) return path;
  if (maxLength <= 0) return "…";
  if (maxLength < 5) return truncateToWidth(path, maxLength);

  const lastSlash = path.lastIndexOf("/");
  const filename = lastSlash >= 0 ? path.slice(lastSlash) : path;
  const directory = lastSlash >= 0 ? path.slice(0, lastSlash) : "";
  const filenameWidth = stringWidth(filename);

  if (filenameWidth >= maxLength - 1) {
    return truncateStartToWidth(path, maxLength);
  }

  const availableForDirectory = maxLength - 1 - filenameWidth;
  if (availableForDirectory <= 0) {
    return truncateStartToWidth(filename, maxLength);
  }

  const truncatedDirectory = truncateToWidthNoEllipsis(
    directory,
    availableForDirectory,
  );
  return `${truncatedDirectory}…${filename}`;
}

export function truncate(
  text: string,
  maxWidth: number,
  singleLine = false,
): string {
  let result = text;
  if (singleLine) {
    const firstNewline = text.indexOf("\n");
    if (firstNewline !== -1) {
      result = text.slice(0, firstNewline);
      if (stringWidth(result) + 1 > maxWidth) {
        return truncateToWidth(result, maxWidth);
      }
      return `${result}…`;
    }
  }

  if (stringWidth(result) <= maxWidth) {
    return result;
  }
  return truncateToWidth(result, maxWidth);
}

export function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  let currentLine = "";
  let currentWidth = 0;

  for (const { segment } of getGraphemeSegmenter().segment(text)) {
    const segWidth = graphemeWidth(segment);
    if (currentWidth + segWidth <= width) {
      currentLine += segment;
      currentWidth += segWidth;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = segment;
      currentWidth = segWidth;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}
