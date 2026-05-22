import * as fs from "fs";
import * as readline from "readline";

import { throwIfFileIsSecurityConcern } from "core/indexing/ignore.js";
import { ContinueError, ContinueErrorReason } from "core/util/errors.js";

import { formatToolArgument } from "./formatters.js";
import { Tool, ToolRunContext } from "./types.js";

/**
 * Space complexity: O(output) — never O(file size).
 *
 * File reading uses fs.createReadStream + readline to process the file as a
 * stream of lines. At no point is the full file loaded into memory:
 *   - Lines before `offset` are counted and discarded immediately
 *   - Lines in the window are accumulated only until the byte cap is hit
 *   - The stream is destroyed as soon as we have enough output
 *
 * Peak memory is bounded by MAX_BYTES (~50 KB) regardless of file size.
 */

// Hard byte cap per read (~50 KB ≈ 12,500 tokens; leaves ~90% of context for reasoning)
const MAX_BYTES = 50 * 1024;
// Per-line truncation guard against pathological lines (minified code, generated files)
const MAX_LINE_LENGTH = 2000;
const DEFAULT_LIMIT = 2000;

/**
 * Stream the file line-by-line, collecting only the requested window.
 *
 * Uses readline over a ReadStream so the OS delivers data in chunks;
 * we never allocate more than the output window + a single OS buffer at once.
 * The stream is destroyed early (via rl.close() + stream.destroy()) the
 * moment the byte cap or line limit is reached, releasing the file descriptor
 * immediately without reading the rest of the file.
 */
function streamReadWindow(
  realPath: string,
  offset: number, // 1-based, inclusive start line
  effectiveLimit: number, // max lines to collect
  effectiveMaxBytes: number, // hard byte cap on collected output
): Promise<{
  outputLines: string[];
  linesRead: number;
  cut: boolean; // true if stopped by byte cap before reaching line limit
  more: boolean; // true if file has more lines beyond what we returned
}> {
  return new Promise((resolve, reject) => {
    // createReadStream delivers file data in OS-sized chunks (typically 64 KB).
    // readline splits those chunks on newline boundaries — one line at a time.
    const stream = fs.createReadStream(realPath, { encoding: "utf-8" });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    const outputLines: string[] = [];
    let globalLineCount = 0; // tracks every line seen, including skipped ones
    let byteCount = 0;
    let cut = false;
    let streamDone = false;

    // stopStream: close readline and destroy the underlying ReadStream so the
    // file descriptor is released and no further OS reads are issued.
    const stopStream = () => {
      if (!streamDone) {
        streamDone = true;
        rl.close();
        stream.destroy();
      }
    };

    rl.on("line", (rawLine: string) => {
      globalLineCount += 1;

      // Skip lines before the requested offset window (1-based)
      if (globalLineCount < offset) {
        return;
      }

      // Stop if we have already collected the requested number of lines
      if (outputLines.length >= effectiveLimit) {
        // more=true: there are lines beyond our window
        cut = false;
        stopStream();
        return;
      }

      // Truncate pathological lines (minified JS, generated code, etc.)
      const line =
        rawLine.length > MAX_LINE_LENGTH
          ? rawLine.substring(0, MAX_LINE_LENGTH) +
            "... (line truncated to 2000 chars)"
          : rawLine;

      const lineBytes = Buffer.byteLength(line, "utf-8") + 1; // +1 for newline

      // Hard byte cap: stop accumulating if adding this line would exceed the cap
      if (byteCount + lineBytes > effectiveMaxBytes) {
        cut = true;
        stopStream();
        return;
      }

      outputLines.push(line);
      byteCount += lineBytes;
    });

    rl.on("close", () => {
      const linesRead = outputLines.length;
      // more=true if: byte cap fired (cut) OR we stopped at the line limit
      // and there were still lines left in the file after our window.
      // globalLineCount > offset - 1 + linesRead means we saw at least one
      // line beyond our output window.
      const more = cut || globalLineCount >= offset + effectiveLimit - 1;
      resolve({ outputLines, linesRead, cut, more });
    });

    rl.on("error", reject);
    stream.on("error", reject);
  });
}

// Track files that have been read in the current session
export const readFilesSet = new Set<string>();
export function markFileAsRead(filePath: string) {
  readFilesSet.add(filePath);
}

export const readFileTool: Tool = {
  name: "Read",
  displayName: "Read",
  description:
    "Read the contents of a file at the specified path. For large files, use the offset and limit parameters to read a specific range of lines. When the response indicates more lines are available, continue reading with the next offset.",
  parameters: {
    type: "object",
    required: ["filepath"],
    properties: {
      filepath: {
        type: "string",
        description: "The path to the file to read",
      },
      offset: {
        type: "number",
        description:
          "The 1-based line number to start reading from. Defaults to 1 (beginning of file).",
      },
      limit: {
        type: "number",
        description:
          "The maximum number of lines to read. Defaults to 2000. Output is also capped at 50 KB regardless of this value.",
      },
    },
  },
  readonly: true,
  isBuiltIn: true,
  preprocess: async (args) => {
    let { filepath } = args;
    if (filepath.startsWith("./")) {
      filepath = filepath.slice(2);
    }
    throwIfFileIsSecurityConcern(filepath);
    return {
      args,
      preview: [
        {
          type: "text",
          content: `Will read ${formatToolArgument(filepath)}`,
        },
      ],
    };
  },
  run: async (
    args: { filepath: string; offset?: number; limit?: number },
    context?: ToolRunContext,
  ): Promise<string> => {
    try {
      let { filepath } = args;
      if (filepath.startsWith("./")) {
        filepath = filepath.slice(2);
      }

      if (!fs.existsSync(filepath)) {
        throw new ContinueError(
          ContinueErrorReason.Unspecified,
          `File does not exist: ${filepath}`,
        );
      }
      const realPath = fs.realpathSync(filepath);

      // Clamp offset to ≥ 1: offset=0 or negative would break 1-based line
      // numbering and make nextOffset non-advancing (infinite pagination loop).
      const offset = Math.max(1, args.offset ?? 1);
      // Clamp limit to ≥ 1: limit=0 would make effectiveLimit collapse to 0,
      // causing the stream to immediately stop with linesRead=0 and
      // nextOffset=offset, which produces an infinite pagination loop.
      const limit = Math.max(1, args.limit ?? DEFAULT_LIMIT);

      // Divide limit and byte cap by parallel tool call count to avoid
      // context overflow when multiple tools run concurrently
      const parallelCount = context?.parallelToolCallCount ?? 1;
      // Ensure effectiveLimit is at least 1 even after integer division
      // (e.g. limit=1 with parallelCount=4 would floor to 0 without the clamp).
      const effectiveLimit = Math.max(1, Math.floor(limit / parallelCount));
      const effectiveMaxBytes = Math.floor(MAX_BYTES / parallelCount);

      // Stream the file — never loads more than one OS chunk + output window
      const { outputLines, linesRead, cut, more } = await streamReadWindow(
        realPath,
        offset,
        effectiveLimit,
        effectiveMaxBytes,
      );

      // Mark this file as read for the edit tool's pre-read guard
      markFileAsRead(realPath);

      // Prepend 1-based line numbers so the LLM can reference exact lines
      // and copy the nextOffset value directly for the follow-up call
      const numberedContent = outputLines
        .map((line, i) => `${offset + i}: ${line}`)
        .join("\n");

      // next 1-based offset for the caller to continue pagination
      const nextOffset = offset + linesRead;

      const parallelNote =
        cut && parallelCount > 1
          ? ` (Note: byte limit reduced due to ${parallelCount} parallel tool calls.)`
          : "";

      const paginationNote = more
        ? `\n\n(Output capped at ${(effectiveMaxBytes / 1024).toFixed(0)} KB.${parallelNote} Use offset=${nextOffset} to continue reading.)`
        : "";

      return `Content of ${filepath} (lines ${offset}-${offset + linesRead - 1}):\n${numberedContent}${paginationNote}`;
    } catch (error) {
      if (error instanceof ContinueError) {
        throw error;
      }
      throw new Error(
        `Error reading file: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  },
};
