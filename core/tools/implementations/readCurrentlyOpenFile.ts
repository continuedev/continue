import { getUriDescription } from "../../util/uri";

import { ToolImpl } from ".";
import { throwIfFileIsSecurityConcern } from "../../indexing/ignore";
import { getOptionalNumberArg } from "../parseArgs";

/**
 * Space complexity: O(output) — never O(file size).
 *
 * getCurrentFile() returns the live editor buffer that VS Code already holds
 * in memory — there is nothing to stream from disk. Wrapping it in a
 * ReadStream would be pure overhead.
 *
 * Instead we apply the same byte-cap + offset/limit slicing pattern used by
 * readFileImpl directly on the in-memory string:
 *
 *   contents (editor buffer, already in RAM)
 *     → split("\n")                 — O(lines in window), not O(file)
 *     → skip lines before offset    — O(1) via Array.slice
 *     → accumulate until 50 KB cap  — O(output)
 *     → return chunk + pagination note
 *
 * We never throw for file size. The LLM always receives a useful chunk and
 * a clear offset= hint to continue reading if more lines exist.
 *
 * throwIfFileExceedsHalfOfContext is intentionally removed: it checked LLM
 * context consumption but did so by throwing, which left the LLM stuck with
 * no output. The 50 KB byte cap achieves the same protection without errors.
 */

// Hard byte cap per read (~50 KB ≈ 12,500 tokens; leaves ~90% of context for reasoning)
const MAX_BYTES = 50 * 1024;
// Per-line truncation guard against pathological lines (minified code, generated files)
const MAX_LINE_LENGTH = 2000;
const DEFAULT_LIMIT = 2000;

export const readCurrentlyOpenFileImpl: ToolImpl = async (args, extras) => {
  const result = await extras.ide.getCurrentFile();

  // No file is open in the editor — return a clear message so the LLM knows
  if (!result) {
    return [
      {
        name: "No Current File",
        description: "",
        content: "There are no files currently open.",
      },
    ];
  }

  // Security check: reject sensitive files (keys, secrets, certs, etc.)
  throwIfFileIsSecurityConcern(result.path);

  // offset is 1-based line number to start from (default: beginning of file)
  const offset = getOptionalNumberArg(args, "offset") ?? 1;
  // limit is max lines to return in this read (default: 2000)
  const limit = getOptionalNumberArg(args, "limit") ?? DEFAULT_LIMIT;

  // contents is the live VS Code editor buffer — already in RAM.
  // We slice it directly; no disk I/O or streaming needed.
  const allLines = result.contents.split("\n");
  const totalLines = allLines.length;

  // offset is 1-based; convert to 0-based index and clamp to valid range
  const startIdx = Math.max(0, offset - 1);
  // Slice only the requested window — O(limit) not O(file size)
  const requestedLines = allLines.slice(startIdx, startIdx + limit);

  // Apply the 50 KB byte cap as a guard against very wide lines or a large limit.
  // Accumulate lines one at a time and stop the moment the cap would be exceeded.
  const outputLines: string[] = [];
  let byteCount = 0;
  let cut = false;

  for (const rawLine of requestedLines) {
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
  // more=true when byte cap fired (cut) OR the window didn't reach end of file
  const more = cut || startIdx + linesRead < totalLines;

  const { relativePathOrBasename, last2Parts, baseName } = getUriDescription(
    result.path,
    await extras.ide.getWorkspaceDirs(),
  );

  // Prepend 1-based line numbers so the LLM can reference exact lines
  // and copy the nextOffset value directly for the follow-up call
  const numberedContent = outputLines
    .map((line, i) => `${offset + i}: ${line}`)
    .join("\n");

  const paginationNote = more
    ? `\n\n(Output capped at 50 KB. Use offset=${nextOffset} to continue reading.)`
    : "";

  // Wrap in a fenced code block with the relative path as the language hint,
  // preserving the original display format expected by the chat UI
  const content = `\`\`\`${relativePathOrBasename}\n${numberedContent}\n\`\`\`${paginationNote}`;

  const description = more
    ? `${last2Parts} (lines ${offset}-${offset + linesRead - 1} of ${totalLines})`
    : last2Parts;

  return [
    {
      name: `Current file: ${baseName}`,
      description,
      content,
      uri: {
        type: "file",
        value: result.path,
      },
    },
  ];
};
