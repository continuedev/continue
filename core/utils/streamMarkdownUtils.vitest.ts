import { expect, test } from "vitest";
import { LineStream } from "../diff/util";
import {
  processBlockNesting,
  stopAtLinesWithMarkdownSupport,
} from "./streamMarkdownUtils";

test("processBlockNesting correctly handles starting blocks", () => {
  // Mock function to determine which lines should be removed
  const shouldRemoveLineBeforeStart = (line: string) =>
    line === "[CODE]" || line === "```";

  // Test not seeing first fence yet
  const result1 = processBlockNesting(
    "[CODE]",
    false,
    shouldRemoveLineBeforeStart,
  );
  expect(result1.newSeenFirstFence).toBe(false);
  expect(result1.shouldSkip).toBe(true);

  // Test not seeing first fence but line shouldn't be removed
  const result2 = processBlockNesting(
    "normal code",
    false,
    shouldRemoveLineBeforeStart,
  );
  expect(result2.newSeenFirstFence).toBe(true);
  expect(result2.shouldSkip).toBe(false);

  // Test already seen first fence
  const result3 = processBlockNesting(
    "more code",
    true,
    shouldRemoveLineBeforeStart,
  );
  expect(result3.newSeenFirstFence).toBe(true);
  expect(result3.shouldSkip).toBe(false);
});

test("stopAtLinesWithMarkdownSupport handles non-markdown files", async () => {
  // Create a mock line stream
  const mockLines = ["line 1", "line 2", "```", "line 4"];
  const lineStream: LineStream = (async function* () {
    for (const line of mockLines) {
      yield line;
    }
  })();

  // Test with a non-markdown file
  const filename = "test.js";
  const result = stopAtLinesWithMarkdownSupport(lineStream, filename);

  // Should only yield lines up to the backticks
  const collected = [];
  for await (const line of result) {
    collected.push(line);
  }

  expect(collected).toEqual(["line 1", "line 2"]);
});

test("stopAtLinesWithMarkdownSupport handles markdown files with no nested blocks", async () => {
  // Create a mock line stream with markdown content - but NOT nested markdown blocks
  const mockLines = [
    "Some markdown text",
    "",
    "```javascript",
    "function test() {",
    "  return true;",
    "}",
    "```",
    "More text",
  ];

  const lineStream: LineStream = (async function* () {
    for (const line of mockLines) {
      yield line;
    }
  })();

  // Test with a markdown file
  const filename = "test.md";
  const result = stopAtLinesWithMarkdownSupport(lineStream, filename);

  // Should yield everything since there's no nested markdown blocks
  const collected = [];
  for await (const line of result) {
    collected.push(line);
  }

  // The function should stop at the standalone ``` line (not yield it or lines after)
  // This is the correct behavior - it stops when it encounters standalone backticks
  expect(collected).toEqual([
    "Some markdown text",
    "",
    "```javascript",
    "function test() {",
    "  return true;",
    "}",
  ]);
});
