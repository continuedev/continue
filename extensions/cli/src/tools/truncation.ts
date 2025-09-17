/**
 * Smart truncation for search results that handles both line count and character limits
 */

export interface TruncationResult {
  content: string;
  truncated: boolean;
  originalLineCount: number;
  truncatedLineCount: number;
  originalCharCount: number;
  truncatedCharCount: number;
}

export interface TruncationOptions {
  maxLines?: number;
  maxChars?: number;
  maxLineLength?: number;
}

const DEFAULT_OPTIONS: Required<TruncationOptions> = {
  maxLines: 100,
  maxChars: 50000, // 50KB reasonable limit for terminal output
  maxLineLength: 1000, // Truncate individual lines that are too long
};

/**
 * Intelligently truncates content based on both line count and character limits
 * Handles edge cases like very long lines (e.g., base64 strings)
 */
export function smartTruncate(
  content: string,
  options: TruncationOptions = {},
): TruncationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lines = content.split('\n');
  const originalLineCount = lines.length;
  const originalCharCount = content.length;

  let truncated = false;
  let processedLines: string[] = [];
  let currentCharCount = 0;

  // Process lines until we hit limits
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if adding this line would exceed our limits
    const wouldExceedLines = processedLines.length >= opts.maxLines;
    const wouldExceedChars = currentCharCount + line.length + 1 > opts.maxChars; // +1 for newline
    
    if (wouldExceedLines || wouldExceedChars) {
      truncated = true;
      break;
    }

    // Truncate individual lines that are too long
    let processedLine = line;
    if (line.length > opts.maxLineLength) {
      processedLine = line.substring(0, opts.maxLineLength) + '... [line truncated]';
      truncated = true;
    }

    processedLines.push(processedLine);
    currentCharCount += processedLine.length + 1; // +1 for newline
  }

  const truncatedContent = processedLines.join('\n');
  
  return {
    content: truncatedContent,
    truncated,
    originalLineCount,
    truncatedLineCount: processedLines.length,
    originalCharCount,
    truncatedCharCount: truncatedContent.length,
  };
}

/**
 * Formats truncation message for search results
 */
export function formatTruncationMessage(result: TruncationResult): string {
  if (!result.truncated) {
    return '';
  }

  const messages: string[] = [];
  
  if (result.truncatedLineCount < result.originalLineCount) {
    messages.push(`showing ${result.truncatedLineCount} of ${result.originalLineCount} matches`);
  }
  
  if (result.truncatedCharCount < result.originalCharCount) {
    const originalKB = Math.round(result.originalCharCount / 1000);
    const truncatedKB = Math.round(result.truncatedCharCount / 1000);
    if (originalKB > truncatedKB) {
      messages.push(`${truncatedKB}KB of ${originalKB}KB total`);
    }
  }

  return messages.length > 0 ? `[Results truncated: ${messages.join(', ')}]` : '';
}