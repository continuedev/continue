import { resolveInputPath } from "../../util/pathResolver";
import { getUriPathBasename } from "../../util/uri";

import { ToolImpl } from ".";
import { throwIfFileIsSecurityConcern } from "../../indexing/ignore";
import { getOptionalNumberArg, getStringArg } from "../parseArgs";
import { ContinueError, ContinueErrorReason } from "../../util/errors";
import { MAX_CHAR_POSITION } from "./readFileRange";

/**
 * Space complexity: O(output) — never O(file size).
 *
 * Instead of loading the full file and slicing in memory, we delegate
 * to ide.readRangeInFile() which reads only the requested line window
 * directly from the IDE/filesystem layer (backed by VS Code's
 * vscode.workspace.fs or readRangeInFile API). The full file bytes
 * are never held in this process.
 *
 * After receiving the bounded chunk we apply a 50 KB hard byte cap
 * with per-line truncation so output is always predictably sized
 * regardless of what the IDE returns for the requested range.
 */

// Hard byte cap per read (~50 KB ≈ 12,500 tokens; leaves ~90% of context for reasoning)
const MAX_BYTES = 50 * 1024;
// Per-line truncation guard against pathological lines (minified code, generated files)
const MAX_LINE_LENGTH = 2000;
const DEFAULT_LIMIT = 2000;
const MIN_LIMIT = 200;

export const readFileImpl: ToolImpl = async (args, extras) => {
  const filepath = getStringArg(args, "filepath");
  // offset is 1-based line number to start from (default: beginning of file)
  const offset = getOptionalNumberArg(args, "offset") ?? 1;
  // limit is max lines to return in this read (default: 2000)
  const limit = Math.max(
    MIN_LIMIT,
    getOptionalNumberArg(args, "limit") ?? DEFAULT_LIMIT,
  );

  // Resolve the path first to get the actual path for security check
  const resolvedPath = await resolveInputPath(extras.ide, filepath);
  if (!resolvedPath) {
    throw new ContinueError(
      ContinueErrorReason.FileNotFound,
      `File "${filepath}" does not exist or is not accessible. You might want to check the path and try again.`,
    );
  }

  // Security check on the resolved display path
  throwIfFileIsSecurityConcern(resolvedPath.displayPath);

  // Convert 1-based offset to 0-based line index used by the IDE range API.
  // readRangeInFile fetches ONLY this window from the IDE — the full file
  // is never loaded into this process's memory.
  const startLine = Math.max(0, offset - 1); // 0-based, inclusive
  // Request limit+1 lines (N+1 pattern) so we can detect EOF unambiguously:
  // if the IDE returns > limit lines, there is more content beyond the window.
  const endLine = startLine + limit; // 0-based, inclusive (one extra sentinel line)

  const rangeContent = await extras.ide.readRangeInFile(resolvedPath.uri, {
    start: { line: startLine, character: 0 },
    // MAX_CHAR_POSITION reads to end of line (Java Int.MAX_VALUE for IntelliJ compat)
    end: { line: endLine, character: MAX_CHAR_POSITION },
  });

  // rangeContent is now only the requested window — O(limit) not O(file size).
  // Apply the 50 KB byte cap as a secondary guard against very wide lines
  // or a caller supplying an extremely large limit.
  // Trim to limit before processing — the (limit+1)th line is only a sentinel
  // to detect EOF, not part of the output.
  const allLines = rangeContent.split("\n");
  const hasMore = allLines.length > limit;
  const rawLines = allLines.slice(0, limit);
  const outputLines: string[] = [];
  let byteCount = 0;
  let cut = false;

  for (const rawLine of rawLines) {
    // Truncate pathological lines (minified JS, generated code, etc.)
    const line =
      rawLine.length > MAX_LINE_LENGTH
        ? rawLine.substring(0, MAX_LINE_LENGTH) +
          "... (line truncated to 2000 chars)"
        : rawLine;

    const lineBytes = Buffer.byteLength(line, "utf-8") + 1; // +1 for newline
    if (byteCount + lineBytes > MAX_BYTES) {
      cut = true;
      break;
    }
    outputLines.push(line);
    byteCount += lineBytes;
  }

  const linesRead = outputLines.length;
  // next 1-based offset for the caller to continue pagination
  const nextOffset = offset + linesRead;
  // more=true when byte cap cut the window short OR the IDE returned the
  // sentinel (limit+1)th line, confirming content exists beyond the window.
  const more = cut || hasMore;

  // Prepend 1-based line numbers so the LLM can reference exact lines
  // and copy the nextOffset value directly for the follow-up call
  const numberedContent = outputLines
    .map((line, i) => `${offset + i}: ${line}`)
    .join("\n");

  const paginationNote = more
    ? `\n\n(Output capped at 50 KB. Use offset=${nextOffset} to continue reading.)`
    : "";

  const content = numberedContent + paginationNote;
  const description = more
    ? `${resolvedPath.displayPath} (lines ${offset}-${offset + linesRead - 1})`
    : resolvedPath.displayPath;

  return [
    {
      name: getUriPathBasename(resolvedPath.uri),
      description,
      content,
      uri: {
        type: "file",
        value: resolvedPath.uri,
      },
    },
  ];
};
