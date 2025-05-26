import { DiffLine } from "../../index";

/**
 * Checks if a string matches unified diff format by validating:
 * 1. Has at least one hunk header (@@ -n,m +n,m @@)
 * 2. Contains valid diff content lines (starting with +, -, or space) which are not header lines
 */
export function isUnifiedDiffFormat(diff: string): boolean {
  const lines = diff.trim().split("\n");

  if (lines.length < 3) {
    return false;
  }

  let hasHunkHeader = false;
  let hasValidContent = false;

  for (const line of lines) {
    if (line.startsWith("---") || line.startsWith("+++")) {
      // ignore file headers - they are not required or useful
    } else if (line.match(/^@@ -\d+,?\d* \+\d+,?\d* @@/)) {
      hasHunkHeader = true;
    } else if (line.match(/^[+ -]/) || line === "") {
      hasValidContent = true;
    }
  }

  return hasHunkHeader && hasValidContent;
}

function extractBeforeLines(hunkLines: string[]): string[] {
  return hunkLines
    .filter((line) => line.startsWith("-") || !line.startsWith("+"))
    .map((line) => line.substring(1));
}

/**
 * Applies a unified diff to source code and returns an array of DiffLine objects.
 * Each DiffLine contains a type ("same", "new", or "old") and the line content.
 *
 * @throws Error if the diff cannot be cleanly applied to the source
 */
export function applyUnifiedDiff(
  sourceCode: string,
  unifiedDiffText: string,
): DiffLine[] {
  const sourceLines = sourceCode.split(/\r?\n/);
  const hunks = parseUnifiedDiff(unifiedDiffText);
  const diffResult: DiffLine[] = [];
  let currentPos = 0; // pointer in sourceLines

  for (const hunk of hunks) {
    const hunkBeforeLines = extractBeforeLines(hunk.lines);
    const hunkStart = findHunkInSource(
      sourceLines,
      hunkBeforeLines,
      currentPos,
    );
    if (hunkStart === -1) {
      // All hunks must be found in the source code. If not, throw an error.
      throw new Error("Hunk could not be applied cleanly to source code.");
    }

    // Emit any unchanged lines that come before this hunk.
    for (let i = currentPos; i < hunkStart; i++) {
      diffResult.push({ type: "same", line: sourceLines[i] });
    }
    let hunkSourcePos = hunkStart;

    for (const dline of hunk.lines) {
      const srcLine = sourceLines[hunkSourcePos];
      if (dline.startsWith("+")) {
        // Insertion: output new line (strip the '+' marker)
        diffResult.push({ type: "new", line: dline.substring(1) });
      } else if (dline.startsWith("-")) {
        // Removal: output the removed (old) line and advance the pointer.
        diffResult.push({ type: "old", line: srcLine });
        hunkSourcePos++;
      } else {
        // Context line: use the source line (in case the diff’s context has a minor whitespace error)
        // and advance the pointer.
        diffResult.push({ type: "same", line: srcLine });
        hunkSourcePos++;
      }
    }
    currentPos = hunkSourcePos;
  }

  for (let i = currentPos; i < sourceLines.length; i++) {
    diffResult.push({ type: "same", line: sourceLines[i] });
  }
  return diffResult;
}

interface Hunk {
  lines: string[];
}

/**
 * Parses a unified diff string into an array of hunks.
 * It skips the file header lines (starting with "---" or "+++") and hunk header lines (starting with "@@"),
 * then collects the remaining lines (which may start with '+' or '-' or have no prefix).
 */
function parseUnifiedDiff(diffText: string): Hunk[] {
  const lines = diffText.split(/\r?\n/);
  const hunks: Hunk[] = [];
  let currentHunk: Hunk | null = null;

  for (const line of lines) {
    if (line.startsWith("---") || line.startsWith("+++")) {
      // Skip file header lines.
      continue;
    }
    if (line.startsWith("@@")) {
      if (currentHunk) {
        hunks.push(currentHunk);
      }
      currentHunk = { lines: [] };
      continue;
    }
    currentHunk?.lines.push(line);
  }
  if (currentHunk) {
    hunks.push(currentHunk);
  }
  return hunks;
}

/**
 * Searches for an occurrence of the block of lines (the “before” block) in sourceLines,
 * starting at startIndex. Comparison is done by checking if the lines are exactly equal,
 * or if their trimmed versions are equal.
 *
 * Returns the index in sourceLines where the block begins, or -1 if no match is found.
 */
function findHunkInSource(
  sourceLines: string[],
  hunkBeforeLines: string[],
  startIndex: number,
): number {
  for (
    let i = startIndex;
    i <= sourceLines.length - hunkBeforeLines.length;
    i++
  ) {
    let match = true;
    for (let j = 0; j < hunkBeforeLines.length; j++) {
      const sl = sourceLines[i + j];
      const hl = hunkBeforeLines[j];
      if (!linesMatch(sl, hl)) {
        match = false;
        break;
      }
    }
    if (match) {
      return i;
    }
  }
  return -1;
}

/**
 * Returns true if the two lines are either exactly equal or equal after trimming whitespace and tabs.
 */
function linesMatch(a: string, b: string): boolean {
  const trimmedA = a.replace(/^\s+/, "");
  const trimmedB = b.replace(/^\s+/, "");
  return trimmedA === trimmedB;
}
