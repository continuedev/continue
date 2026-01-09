// Threshold for snapping to line boundaries during character truncation
export const TRUNCATION_LINE_SNAP_THRESHOLD = 1000;

/**
 * Parses an environment variable as a positive integer.
 * Returns the default value if the env var is not set, empty, not a number,
 * zero, or negative.
 */
export function parseEnvNumber(
  envVar: string | undefined,
  defaultValue: number,
): number {
  if (!envVar) {
    return defaultValue;
  }
  const parsed = parseInt(envVar, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return defaultValue;
  }
  return parsed;
}

export interface TruncationResult {
  output: string;
  wasTruncated: boolean;
}

export interface TruncationLimits {
  maxChars: number;
  maxLines: number;
}

/**
 * Truncates output from the beginning to fit within limits, preserving the end.
 * This is the preferred truncation strategy for command output where the most
 * recent output is typically most relevant.
 *
 * When truncated, removes content from the beginning and adds a "(previous output truncated)" note.
 *
 * @param output - The string to truncate
 * @param limits - The character and line limits to apply
 */
export function truncateOutputFromStart(
  output: string,
  limits: TruncationLimits,
): TruncationResult {
  if (!output) {
    return { output, wasTruncated: false };
  }

  const { maxChars, maxLines } = limits;
  const lines = output.split("\n");

  // Check if we need to truncate by lines first
  if (lines.length > maxLines) {
    const linesTruncated = lines.length - maxLines;
    const preservedLines = lines.slice(-maxLines);
    const contentAfterLineTruncation = preservedLines.join("\n");

    // After line truncation, check character limit
    if (contentAfterLineTruncation.length > maxChars) {
      return truncateCharactersFromStart(
        contentAfterLineTruncation,
        linesTruncated,
        maxChars,
      );
    }

    return {
      output: `(previous ${linesTruncated} lines truncated)\n\n${contentAfterLineTruncation}`,
      wasTruncated: true,
    };
  }

  // Check character limit
  if (output.length > maxChars) {
    return truncateCharactersFromStart(output, 0, maxChars);
  }

  return { output, wasTruncated: false };
}

/**
 * Truncates output from the end to fit within a character limit, preserving the beginning.
 * Useful for content where the beginning is most important (e.g., file content, diffs).
 *
 * @param output - The string to truncate
 * @param maxChars - Maximum characters to keep
 * @param context - Optional context for the truncation message (e.g., "file content", "diff")
 */
export function truncateOutputFromEnd(
  output: string,
  maxChars: number,
  context?: string,
): TruncationResult {
  if (!output || output.length <= maxChars) {
    return { output, wasTruncated: false };
  }

  const truncatedContent = output.slice(0, maxChars);

  // Try to end at a clean line boundary
  const lastNewline = truncatedContent.lastIndexOf("\n");
  const shouldSnapToLine =
    lastNewline !== -1 &&
    truncatedContent.length - lastNewline < TRUNCATION_LINE_SNAP_THRESHOLD;
  const cleanContent = shouldSnapToLine
    ? truncatedContent.slice(0, lastNewline)
    : truncatedContent;

  const actualCharsRemoved = output.length - cleanContent.length;
  const contextStr = context ? ` of ${context}` : "";
  const suffix = `\n\n(${actualCharsRemoved} characters${contextStr} truncated)`;

  return {
    output: cleanContent + suffix,
    wasTruncated: true,
  };
}

/**
 * Truncates output by line count from the end, preserving the beginning.
 * Useful for file content where the start of the file is most relevant.
 *
 * @param output - The string to truncate
 * @param maxLines - Maximum lines to keep
 * @param context - Optional context for the truncation message
 */
export function truncateLinesByCount(
  output: string,
  maxLines: number,
  context?: string,
): TruncationResult {
  if (!output) {
    return { output, wasTruncated: false };
  }

  const lines = output.split("\n");
  if (lines.length <= maxLines) {
    return { output, wasTruncated: false };
  }

  const preservedLines = lines.slice(0, maxLines);
  const linesTruncated = lines.length - maxLines;
  const contextStr = context ? ` of ${context}` : "";

  return {
    output:
      preservedLines.join("\n") +
      `\n\n(${linesTruncated} lines${contextStr} truncated)`,
    wasTruncated: true,
  };
}

/**
 * Combined truncation: first by lines, then by characters, preserving the beginning.
 * Used by readFile tool where both limits apply.
 *
 * @param output - The string to truncate
 * @param maxLines - Maximum lines to keep
 * @param maxChars - Maximum characters to keep
 * @param context - Optional context for the truncation message
 */
export function truncateByLinesAndChars(
  output: string,
  maxLines: number,
  maxChars: number,
  context?: string,
): TruncationResult {
  if (!output) {
    return { output, wasTruncated: false };
  }

  // First truncate by lines
  const lineResult = truncateLinesByCount(output, maxLines, context);

  // Then truncate by characters if needed
  if (lineResult.output.length > maxChars) {
    const charResult = truncateOutputFromEnd(
      lineResult.output,
      maxChars,
      context,
    );
    return {
      output: charResult.output,
      wasTruncated: true,
    };
  }

  return lineResult;
}

// =============================================================================
// Internal helper functions
// =============================================================================

function truncateCharactersFromStart(
  text: string,
  linesTruncated: number,
  maxCharacters: number,
): TruncationResult {
  // Remove characters from the beginning, keeping the end
  const truncationPoint = text.length - maxCharacters;
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
