import { describe, expect, it } from "vitest";
import { stripReasoningFromApplyContent } from "./";

describe("stripReasoningFromApplyContent", () => {
  it("should remove think blocks before applying file content", () => {
    const text =
      "<think>Need to plan the edit first</think>\nexport const answer = 42;\n";

    expect(stripReasoningFromApplyContent(text)).toBe(
      "\nexport const answer = 42;\n",
    );
  });

  it("should extract the final Harmony channel content", () => {
    const text =
      "<|start|>assistant<|channel|>analysis<|message|>Thinking about the edit<|end|><|start|>assistant<|channel|>final<|message|>export const answer = 42;\n<|end|>";

    expect(stripReasoningFromApplyContent(text)).toBe(
      "export const answer = 42;\n",
    );
  });

  it("should leave ordinary file content unchanged", () => {
    const text = "export function greet() {\n  return 'hello';\n}\n";

    expect(stripReasoningFromApplyContent(text)).toBe(text);
  });
});
