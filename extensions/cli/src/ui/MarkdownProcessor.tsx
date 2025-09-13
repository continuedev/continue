import { Text } from "ink";
import React from "react";

import {
  defaultTheme,
  detectLanguage,
  highlightCode,
  SyntaxHighlighterTheme,
} from "./SyntaxHighlighter.js";

// Represents a styled segment of text with its formatting information
export interface StyledSegment {
  text: string;
  styling: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    color?: string;
    backgroundColor?: string; // For diff highlights and other background colors
    type?: "text" | "code" | "codeblock" | "heading" | "think";
    language?: string; // For code blocks
  };
}

interface MarkdownPattern {
  regex: RegExp;
  getStyle: (match: RegExpExecArray) => StyledSegment["styling"];
  getContent: (match: RegExpExecArray) => string;
}

const patterns: MarkdownPattern[] = [
  {
    regex: /<think>([\s\S]*?)<\/think>/g,
    getStyle: () => ({ color: "gray", type: "think" }),
    getContent: (match) => match[1].trim(),
  },
  {
    regex: /^(#{1,6})\s+(.+)$/gm,
    getStyle: () => ({ bold: true, type: "heading" }),
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
    regex: /_([^_]+)_/g,
    getStyle: () => ({ italic: true }),
    getContent: (match) => match[1],
  },
  {
    regex: /~~([^~]+)~~/g,
    getStyle: () => ({ strikethrough: true }),
    getContent: (match) => match[1],
  },
  {
    regex: /`([^`\n]+)`/g,
    getStyle: () => ({ color: "magentaBright", type: "code" }),
    getContent: (match) => match[1],
  },
];

/**
 * Process markdown text and return styled segments
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

  // Combine code blocks and other matches
  const combinedMatches: Array<{
    index: number;
    length: number;
    segment: StyledSegment;
  }> = [
    ...codeBlocks.map((block) => ({
      index: block.index,
      length: block.length,
      segment: {
        text: block.code, // Store the raw code, we'll highlight during rendering
        styling: {
          type: "codeblock" as const,
          language: block.language,
        },
      },
    })),
    ...allMatches,
  ];

  // Sort matches by index to process them in order
  combinedMatches.sort((a, b) => a.index - b.index);

  // Process matches, avoiding overlaps
  const processedMatches: typeof combinedMatches = [];
  for (const match of combinedMatches) {
    const overlaps = processedMatches.some(
      (processed) =>
        (match.index >= processed.index &&
          match.index < processed.index + processed.length) ||
        (processed.index >= match.index &&
          processed.index < match.index + match.length),
    );

    if (!overlaps) {
      processedMatches.push(match);
    }
  }

  // Create segments
  processedMatches.forEach((match) => {
    // Add text before this match
    if (match.index > currentIndex) {
      const plainText = text.slice(currentIndex, match.index);
      if (plainText) {
        segments.push({
          text: plainText,
          styling: { type: "text" },
        });
      }
    }

    // Add the styled match
    segments.push(match.segment);
    currentIndex = match.index + match.length;
  });

  // Add remaining text
  if (currentIndex < text.length) {
    const remainingText = text.slice(currentIndex);
    if (remainingText) {
      segments.push({
        text: remainingText,
        styling: { type: "text" },
      });
    }
  }

  // If no segments were created (no patterns found and no remaining text), add the full text as plain text
  if (segments.length === 0 && text) {
    segments.push({
      text: text,
      styling: { type: "text" },
    });
  }

  return segments;
}

/**
 * Render styled segments to React components
 */
export function renderStyledSegments(
  segments: StyledSegment[],
  theme: SyntaxHighlighterTheme = defaultTheme,
): React.ReactNode[] {
  return segments.map((segment, index) => {
    const key = `segment-${index}`;

    if (segment.styling.type === "codeblock") {
      const highlightedCode = highlightCode(
        segment.text,
        segment.styling.language || "text",
        theme,
      );
      return <Text key={key}>{highlightedCode}</Text>;
    }

    return (
      <Text
        key={key}
        bold={segment.styling.bold}
        italic={segment.styling.italic}
        strikethrough={segment.styling.strikethrough}
        color={segment.styling.color}
        backgroundColor={segment.styling.backgroundColor}
      >
        {segment.text}
      </Text>
    );
  });
}

interface RowState {
  rows: StyledSegment[][];
  currentRow: StyledSegment[];
  currentRowLength: number;
}

/**
 * Helper to create a styled segment
 */
function createSegment(
  text: string,
  styling: StyledSegment["styling"],
): StyledSegment {
  return { text, styling };
}

/**
 * Helper to finish current row and start a new one
 */
function finishRow(state: RowState): void {
  if (state.currentRow.length > 0) {
    state.rows.push(state.currentRow);
  }
  state.currentRow = [];
  state.currentRowLength = 0;
}

/**
 * Helper to check if two styling objects match
 */
function stylingMatches(
  a: StyledSegment["styling"],
  b: StyledSegment["styling"],
): boolean {
  return (
    a.type === b.type &&
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.strikethrough === b.strikethrough &&
    a.color === b.color &&
    a.backgroundColor === b.backgroundColor &&
    a.language === b.language
  );
}

/**
 * Handle segments with newlines
 */
function processSegmentWithNewlines(
  segment: StyledSegment,
  state: RowState,
  availableWidth: number,
): void {
  const lines = segment.text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isFirstLine = i === 0;
    const isLastLine = i === lines.length - 1;

    if (isFirstLine) {
      // First line continues current row if there's space
      const fitsInCurrentRow =
        state.currentRowLength + line.length <= availableWidth;

      if (fitsInCurrentRow && line) {
        state.currentRow.push(createSegment(line, segment.styling));
        state.currentRowLength += line.length;
      } else if (!fitsInCurrentRow) {
        // Doesn't fit, start new row
        finishRow(state);
        if (line) {
          state.currentRow.push(createSegment(line, segment.styling));
          state.currentRowLength = line.length;
        }
      }

      // End current row due to newline (unless it's the last line)
      if (!isLastLine) {
        finishRow(state);
      }
    } else if (isLastLine) {
      // Last line starts a new row
      if (line) {
        state.currentRow.push(createSegment(line, segment.styling));
        state.currentRowLength = line.length;
      }
    } else {
      // Middle lines get their own rows
      state.rows.push(line ? [createSegment(line, segment.styling)] : []);
    }
  }
}

/**
 * Handle word that doesn't fit in current row
 */
function processWordThatDoesntFit(
  word: string,
  segment: StyledSegment,
  state: RowState,
  availableWidth: number,
): void {
  finishRow(state);

  if (word.length > availableWidth) {
    // Split long word by characters as fallback
    let remainingWord = word;
    while (remainingWord.length > availableWidth) {
      state.rows.push([
        createSegment(
          remainingWord.substring(0, availableWidth),
          segment.styling,
        ),
      ]);
      remainingWord = remainingWord.substring(availableWidth);
    }
    if (remainingWord) {
      state.currentRow.push(createSegment(remainingWord, segment.styling));
      state.currentRowLength = remainingWord.length;
    }
  } else {
    state.currentRow.push(createSegment(word, segment.styling));
    state.currentRowLength = word.length;
  }
}

/**
 * Add word to current row, either by merging or creating new segment
 */
function addWordToRow(
  textToAdd: string,
  segment: StyledSegment,
  state: RowState,
): void {
  const canMergeWithPrevious =
    state.currentRow.length > 0 &&
    stylingMatches(
      state.currentRow[state.currentRow.length - 1].styling,
      segment.styling,
    );

  if (canMergeWithPrevious) {
    // Merge with previous segment if styling matches
    state.currentRow[state.currentRow.length - 1].text += textToAdd;
  } else {
    // Add as new segment
    state.currentRow.push(createSegment(textToAdd, segment.styling));
  }
}

/**
 * Process words in a segment that needs word wrapping
 */
function processWordsInSegment(
  segment: StyledSegment,
  state: RowState,
  availableWidth: number,
): void {
  const words = segment.text.split(" ");

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const needsSpaceBefore = (state.currentRowLength > 0 && i === 0) || i > 0;
    const spaceToAdd = needsSpaceBefore ? " " : "";
    const totalLength = word.length + spaceToAdd.length;

    if (state.currentRowLength + totalLength <= availableWidth) {
      // Word fits in current row
      const textToAdd = spaceToAdd + word;
      addWordToRow(textToAdd, segment, state);
      state.currentRowLength += totalLength;
    } else {
      // Word doesn't fit, start new row
      processWordThatDoesntFit(word, segment, state, availableWidth);
    }
  }
}

/**
 * Split styled segments into rows based on terminal width while preserving styling
 * Each row contains segments that fit within the specified width
 */
export function splitStyledSegmentsIntoRows(
  segments: StyledSegment[],
  terminalWidth: number,
): StyledSegment[][] {
  const availableWidth = terminalWidth - 6; // Account for bullet and spacing
  const state: RowState = {
    rows: [],
    currentRow: [],
    currentRowLength: 0,
  };

  for (const segment of segments) {
    if (segment.text.includes("\n")) {
      processSegmentWithNewlines(segment, state, availableWidth);
    } else {
      processWordsInSegment(segment, state, availableWidth);
    }
  }

  // Add the final row if it has content
  if (state.currentRow.length > 0 || state.rows.length === 0) {
    state.rows.push(state.currentRow);
  }

  return state.rows;
}

/**
 * Simple component that renders styled segments - can be used as a drop-in replacement for MarkdownRenderer
 */
export const StyledSegmentRenderer: React.FC<{
  segments: StyledSegment[];
  theme?: SyntaxHighlighterTheme;
}> = React.memo(({ segments, theme = defaultTheme }) => {
  return <Text>{renderStyledSegments(segments, theme)}</Text>;
});

StyledSegmentRenderer.displayName = "StyledSegmentRenderer";
