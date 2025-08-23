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

export function buildRipgrepArgs(
  query: string,
  { extraArgs, maxResults }: { extraArgs?: string[]; maxResults?: number } = {},
): string[] {
  const args = [...DEFAULT_RIPGREP_ARGS];
  const sanitized = sanitizeRipgrepArgs(extraArgs);

  let before = DEFAULT_CONTEXT_BEFORE;
  let after = DEFAULT_CONTEXT_AFTER;
  const remaining: string[] = [];

  for (let i = 0; i < sanitized.length; i++) {
    const arg = sanitized[i];
    if ((arg === "-A" || arg === "-B" || arg === "-C") && i + 1 < sanitized.length) {
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
    remaining.push(arg);
  }

  if (before === after) {
    args.push("-C", before.toString());
  } else {
    args.push("-A", after.toString(), "-B", before.toString());
  }

  args.push(HEADING_FLAG);

  if (typeof maxResults === "number") {
    args.push("-m", maxResults.toString());
  }

  args.push(...remaining);
  args.push("-e", query, ".");
  return args;
}

/*
  Formats the output of a grep search to reduce unnecessary indentation, lines, etc
  Assumes a command with these params
    ripgrep -i --ignore-file .continueignore --ignore-file .gitignore -C 2 --heading -m 100 -e <query> .

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

  function countLeadingSpaces(line: string) {
    return line?.match(/^ */)?.[0].length ?? 0;
  }

  const processResult = (lines: string[]) => {
    // Skip results in which only the file path was kept
    const resultPath = lines[0];
    const resultContent = lines.slice(1);
    if (resultContent.length === 0) {
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
  for (const line of results.split("\n").filter((l) => !!l)) {
    if (line.startsWith("./") || line === "--") {
      processResult(resultLines); // process previous result
      resultLines = [line];
      numResults++;
      continue;
    }

    // Exclude leading zero- or single-char lines
    if (resultLines.length === 1 && line.trim().length <= 1) {
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
