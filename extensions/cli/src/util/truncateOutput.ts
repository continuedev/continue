export const TRUNCATION_MAX_CHARACTERS = 50000;
export const TRUNCATION_MAX_LINES = 1000;
export const TRUNCATION_LINE_SNAP_THRESHOLD = 1000;

interface TruncationResult {
  output: string;
  wasTruncated: boolean;
}

/**
 * Truncates output from the beginning to fit within limits, preserving the end.
 *
 * Limits: max 50000 characters OR 1000 lines, whichever is smaller.
 * When truncated, removes content from the beginning and adds a "(previous output truncated)" note.
 */
export function truncateOutputFromStart(output: string): TruncationResult {
  if (!output) {
    return { output, wasTruncated: false };
  }

  const lines = output.split("\n");

  // Check if we need to truncate by lines first
  if (lines.length > TRUNCATION_MAX_LINES) {
    const linesTruncated = lines.length - TRUNCATION_MAX_LINES;
    const preservedLines = lines.slice(-TRUNCATION_MAX_LINES);
    const contentAfterLineTruncation = preservedLines.join("\n");

    // After line truncation, check character limit
    if (contentAfterLineTruncation.length > TRUNCATION_MAX_CHARACTERS) {
      return truncateCharactersFromStart(
        contentAfterLineTruncation,
        linesTruncated,
      );
    }

    return {
      output: `(previous ${linesTruncated} lines truncated)\n\n${contentAfterLineTruncation}`,
      wasTruncated: true,
    };
  }

  // Check character limit
  if (output.length > TRUNCATION_MAX_CHARACTERS) {
    return truncateCharactersFromStart(output, 0);
  }

  return { output, wasTruncated: false };
}

function truncateCharactersFromStart(
  text: string,
  linesTruncated: number,
): TruncationResult {
  // Remove characters from the beginning, keeping the end
  const truncationPoint = text.length - TRUNCATION_MAX_CHARACTERS;
  const textToKeep = text.slice(truncationPoint);

  // Try to start at a clean line boundary, but only if there's a newline
  // within a reasonable distance. Otherwise just cut mid-line.
  const firstNewline = textToKeep.indexOf("\n");
  const shouldSnapToLine =
    firstNewline !== -1 && firstNewline < TRUNCATION_LINE_SNAP_THRESHOLD;
  const cleanText = shouldSnapToLine
    ? textToKeep.slice(firstNewline + 1)
    : textToKeep;

  const charsRemoved = text.length - cleanText.length;

  let prefix: string;
  if (linesTruncated > 0) {
    prefix = `(previous output truncated: ${linesTruncated} lines and ${charsRemoved} characters removed)\n\n`;
  } else {
    prefix = `(previous ${charsRemoved} characters truncated)\n\n`;
  }

  return {
    output: prefix + cleanText,
    wasTruncated: true,
  };
}
