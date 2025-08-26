export const DEFAULT_RIPGREP_ARGS = [
  "-i", // Case-insensitive search
  "--ignore-file",
  ".continueignore",
  "--ignore-file",
  ".gitignore",
];

const DEFAULT_CONTEXT_BEFORE = 2;
const DEFAULT_CONTEXT_AFTER = 2;
const HEADING_FLAG = "--heading";

function sanitizeRipgrepArgs(args?: string[]): string[] {
  if (!args) {
    return [];
  }
  const unsafe = /[|;&`]/;
  return args.filter(
    (arg): arg is string => typeof arg === "string" && !unsafe.test(arg),
  );
}

/**
 * Validates and sanitizes a search path for use with ripgrep
 * @param searchPath The path to validate (can be file or directory)
 * @returns The sanitized path or throws an error if invalid
 */
function validateSearchPath(searchPath: string): string {
  // Remove any potentially dangerous characters
  const dangerous = /[|;&`$(){}[\]]/;
  if (dangerous.test(searchPath)) {
    throw new Error(`Invalid characters in search path: ${searchPath}`);
  }

  // Normalize path separators and remove leading/trailing whitespace
  const normalized = searchPath.trim().replace(/\\/g, "/");

  // Don't allow absolute paths or path traversal for security
  if (
    normalized.startsWith("/") ||
    normalized.includes("../") ||
    normalized.includes("..\\")
  ) {
    throw new Error(
      `Absolute paths and path traversal not allowed: ${searchPath}`,
    );
  }

  return normalized;
}

/**
 * Validates and potentially fixes common regex pattern issues for ripgrep
 * @param query The regex pattern to validate
 * @returns The validated pattern or throws an error if invalid
 */
function validateRipgrepPattern(query: string): string {
  // Check for common problematic patterns and provide helpful error messages
  if (query.includes("\\b") && query.includes("|")) {
    // Common issue: complex patterns with word boundaries and alternations
    // These should work but may need careful escaping
    console.warn(
      "Complex pattern detected with word boundaries and alternations. Ensure proper escaping.",
    );
  }

  if (query.match(/\\[^bdswnrtfav\\]/)) {
    console.warn(
      "Unusual escape sequence detected in pattern. Double-check escaping.",
    );
  }

  return query;
}

export function buildRipgrepArgs(
  query: string,
  {
    extraArgs,
    maxResults,
    path,
  }: { extraArgs?: string[]; maxResults?: number; path?: string } = {},
): string[] {
  const args = [...DEFAULT_RIPGREP_ARGS];
  const sanitized = sanitizeRipgrepArgs(extraArgs);

  // Validate the query pattern
  const validatedQuery = validateRipgrepPattern(query);

  let before = DEFAULT_CONTEXT_BEFORE;
  let after = DEFAULT_CONTEXT_AFTER;
  let useLineNumbers = false;
  const remaining: string[] = [];

  for (let i = 0; i < sanitized.length; i++) {
    const arg = sanitized[i];
    if (
      (arg === "-A" || arg === "-B" || arg === "-C") &&
      i + 1 < sanitized.length
    ) {
      const val = parseInt(sanitized[i + 1]!, 10);
      if (!isNaN(val)) {
        if (arg === "-A") {
          after = val;
        } else if (arg === "-B") {
          before = val;
        } else if (arg === "-C") {
          before = val;
          after = val;
        }
        i++; // skip number
        continue;
      }
    }
    // Detect line number flag
    if (arg === "-n" || arg === "--line-number") {
      useLineNumbers = true;
      remaining.push(arg);
      continue;
    }
    remaining.push(arg);
  }

  if (before === after) {
    args.push("-C", before.toString());
  } else {
    args.push("-A", after.toString(), "-B", before.toString());
  }

  // Only use --heading if line numbers are NOT requested
  // --heading and -n are mutually exclusive in ripgrep
  if (!useLineNumbers) {
    args.push(HEADING_FLAG);
  }

  if (typeof maxResults === "number") {
    args.push("-m", maxResults.toString());
  }

  args.push(...remaining);

  // Determine search target (path or current directory)
  const searchTarget = path ? validateSearchPath(path) : ".";
  console.log(
    `[DEBUG] Final ripgrep args: ${JSON.stringify(args.concat(["-e", validatedQuery, searchTarget]))}`,
  );
  args.push("-e", validatedQuery, searchTarget);
  return args;
}

/*
  Formats the output of a grep search to reduce unnecessary indentation, lines, etc
  Handles both standard ripgrep output with --heading and simple file lists (e.g., with -l flag)
  
  Standard format:
    ripgrep -i --ignore-file .continueignore --ignore-file .gitignore -C 2 --heading -m 100 -e <query> .
  
  File list format (with -l flag):
    ripgrep -l -i --ignore-file .continueignore --ignore-file .gitignore -e <query> .

  Also can truncate the output to a specified number of characters
*/
export function formatGrepSearchResults(
  results: string,
  maxChars?: number,
): {
  formatted: string;
  numResults: number;
  truncated: boolean;
} {
  let numResults = 0;
  const keepLines: string[] = [];

  // Check if this looks like a simple file list (only file paths, no content)
  const lines = results.split("\n").filter((l) => !!l);

  // File list only if:
  // 1. All non-empty lines start with ./ (file paths)
  // 2. There are no content lines (lines that don't start with ./)
  const filePathLines = lines.filter((line) => line.startsWith("./"));
  const contentLines = lines.filter(
    (line) => !line.startsWith("./") && line !== "--",
  );
  const isFileListOnly = filePathLines.length > 0 && contentLines.length === 0;

  // Handle single-file results (no file path headers)
  const isSingleFileResult =
    filePathLines.length === 0 && contentLines.length > 0;

  if (isFileListOnly) {
    // Handle simple file list output (e.g., from -l flag)
    const fileLines = lines.filter((line) => line.startsWith("./"));
    numResults = fileLines.length;
    const formatted = fileLines.join("\n");

    if (maxChars && formatted.length > maxChars) {
      return {
        formatted: formatted.substring(0, maxChars),
        numResults,
        truncated: true,
      };
    } else {
      return {
        formatted,
        numResults,
        truncated: false,
      };
    }
  }

  if (isSingleFileResult) {
    // Handle single-file results (no file path headers)
    numResults = 1;
    const formatted = lines.join("\n");

    if (maxChars && formatted.length > maxChars) {
      return {
        formatted: formatted.substring(0, maxChars),
        numResults,
        truncated: true,
      };
    } else {
      return {
        formatted,
        numResults,
        truncated: false,
      };
    }
  }

  // Handle standard format with content
  function countLeadingSpaces(line: string) {
    return line?.match(/^ */)?.[0].length ?? 0;
  }

  const processResult = (lines: string[]) => {
    // Handle file path lines
    const resultPath = lines[0];
    const resultContent = lines.slice(1);

    // For file-only results (like with -l), still include the path
    if (resultContent.length === 0) {
      if (resultPath && resultPath.startsWith("./")) {
        keepLines.push(resultPath);
      }
      return;
    }

    // Add path
    keepLines.push(resultPath);

    // Find the minimum indentation of content lines
    let minIndent = Infinity;
    for (const line of resultContent) {
      const indent = countLeadingSpaces(line);
      if (indent < minIndent) {
        minIndent = indent;
      }
    }

    // Make all lines line up to 2-space indent
    const changeIndentBy = 2 - minIndent;
    if (changeIndentBy === 0) {
      keepLines.push(...resultContent);
    } else if (changeIndentBy < 0) {
      keepLines.push(
        ...resultContent.map((line) => line.substring(-changeIndentBy)),
      );
    } else {
      keepLines.push(
        ...resultContent.map((line) => " ".repeat(changeIndentBy) + line),
      );
    }
  };

  let resultLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("./") || line === "--") {
      processResult(resultLines); // process previous result
      resultLines = [line];
      numResults++;
      continue;
    }

    // Skip completely empty lines, but keep single-char content that might be meaningful
    if (resultLines.length === 1 && line.trim().length === 0) {
      continue;
    }

    resultLines.push(line);
  }
  processResult(resultLines);

  const formatted = keepLines.join("\n");
  if (maxChars && formatted.length > maxChars) {
    return {
      formatted: formatted.substring(0, maxChars),
      numResults,
      truncated: true,
    };
  } else {
    return {
      formatted,
      numResults,
      truncated: false,
    };
  }
}
