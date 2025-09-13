import {
  defaultTheme,
  detectLanguage,
  SyntaxHighlighterTheme,
} from "../SyntaxHighlighter.js";
import type { StyledSegment } from "../types/messageTypes.js";

interface MarkdownPattern {
  regex: RegExp;
  getStyle: (match: RegExpExecArray) => StyledSegment["styling"];
  getContent: (match: RegExpExecArray) => string;
}

const patterns: MarkdownPattern[] = [
  {
    regex: /<think>([\s\S]*?)<\/think>/g,
    getStyle: () => ({ color: "gray" }),
    getContent: (match) => match[1].trim(),
  },
  {
    regex: /^(#{1,6})\s+(.+)$/gm,
    getStyle: () => ({ bold: true }),
    getContent: (match) => match[2],
  },
  {
    regex: /\*\*(.+?)\*\*/g,
    getStyle: () => ({ bold: true }),
    getContent: (match) => match[1],
  },
  {
    regex: /\*([^\s*][^*]*[^\s*]|[^\s*])\*/g,
    getStyle: () => ({ italic: true }),
    getContent: (match) => match[1],
  },
  {
    regex: /~~(.+?)~~/g,
    getStyle: () => ({ strikethrough: true }),
    getContent: (match) => match[1],
  },
  {
    regex: /`([^`]+)`/g,
    getStyle: () => ({ backgroundColor: "#333", color: "white" }),
    getContent: (match) => match[1],
  },
];

/**
 * Process markdown text into styled segments with simplified StyledSegment format
 * This removes the unused semantic type field from the original implementation
 */
export function processMarkdownToSegments(
  text: string | null | undefined,
  _theme: SyntaxHighlighterTheme = defaultTheme,
): StyledSegment[] {
  if (!text) {
    return [];
  }

  const segments: StyledSegment[] = [];
  let currentIndex = 0;

  // First, handle code blocks separately
  const codeBlockRegex = /```(?:(\w+)\n)?([\s\S]*?)```/g;
  const codeBlocks: Array<{
    index: number;
    length: number;
    language: string;
    code: string;
  }> = [];

  let codeMatch;
  while ((codeMatch = codeBlockRegex.exec(text)) !== null) {
    const language = codeMatch[1] || detectLanguage(codeMatch[2]);
    codeBlocks.push({
      index: codeMatch.index,
      length: codeMatch[0].length,
      language,
      code: codeMatch[2].trim(),
    });
  }

  // Find all matches for other patterns (excluding code blocks)
  const allMatches: Array<{
    index: number;
    length: number;
    segment: StyledSegment;
  }> = [];

  patterns.forEach((pattern) => {
    let match: RegExpExecArray | null;
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);

    while ((match = regex.exec(text)) !== null) {
      // Skip if this match is inside a code block
      const isInCodeBlock = codeBlocks.some(
        (block) =>
          match!.index >= block.index &&
          match!.index < block.index + block.length,
      );

      if (!isInCodeBlock) {
        allMatches.push({
          index: match.index,
          length: match[0].length,
          segment: {
            text: pattern.getContent(match),
            styling: pattern.getStyle(match),
          },
        });
      }
    }
  });

  // Sort matches by index
  const sortedMatches = [
    ...allMatches,
    ...codeBlocks.map((block) => ({
      index: block.index,
      length: block.length,
      segment: {
        text: block.code,
        styling: { codeLanguage: block.language },
      },
    })),
  ].sort((a, b) => a.index - b.index);

  // Build segments by processing matches and plain text in order
  sortedMatches.forEach((match) => {
    // Add plain text before this match
    if (currentIndex < match.index) {
      const plainText = text.slice(currentIndex, match.index);
      if (plainText) {
        segments.push({
          text: plainText,
          styling: {},
        });
      }
    }

    // Add the styled segment
    segments.push(match.segment);
    currentIndex = match.index + match.length;
  });

  // Add any remaining plain text
  if (currentIndex < text.length) {
    const plainText = text.slice(currentIndex);
    if (plainText) {
      segments.push({
        text: plainText,
        styling: {},
      });
    }
  }

  return segments;
}

/**
 * Split styled segments into terminal-width rows
 * Each row contains segments that fit within the specified width
 */
export function splitStyledSegmentsIntoRows(
  segments: StyledSegment[],
  terminalWidth: number,
): StyledSegment[][] {
  if (segments.length === 0) {
    return [[]];
  }

  const rows: StyledSegment[][] = [];
  let currentRow: StyledSegment[] = [];
  let currentRowWidth = 0;

  segments.forEach((segment) => {
    const segmentText = segment.text;
    const words = segmentText.split(/(\s+)/);

    words.forEach((word) => {
      const wordWidth = word.length;

      // Check if adding this word would exceed terminal width
      if (
        currentRowWidth + wordWidth > terminalWidth &&
        currentRow.length > 0
      ) {
        // Start a new row
        rows.push(currentRow);
        currentRow = [];
        currentRowWidth = 0;
      }

      // Add word to current row
      if (
        currentRow.length === 0 ||
        currentRow[currentRow.length - 1].styling !== segment.styling
      ) {
        // Create new segment if this is the first segment or styling is different
        currentRow.push({
          text: word,
          styling: segment.styling,
        });
      } else {
        // Append to last segment if styling is the same
        currentRow[currentRow.length - 1].text += word;
      }

      currentRowWidth += wordWidth;
    });
  });

  // Add the final row if it has content
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  return rows.length > 0 ? rows : [[]];
}
