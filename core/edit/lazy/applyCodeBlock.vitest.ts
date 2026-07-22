import { beforeEach, describe, expect, test, vi } from "vitest";

const { deterministicApplyLazyEdit } = vi.hoisted(() => ({
  deterministicApplyLazyEdit: vi.fn(),
}));

vi.mock("../../util/treeSitter", () => ({
  supportedLanguages: {
    ts: {},
  },
}));

vi.mock("./deterministic", () => ({
  deterministicApplyLazyEdit,
}));

import { applyCodeBlock } from "./applyCodeBlock";

describe("applyCodeBlock", () => {
  beforeEach(() => {
    deterministicApplyLazyEdit.mockReset();
    deterministicApplyLazyEdit.mockResolvedValue([
      { type: "old", line: "export const answer = 41;" },
      { type: "new", line: "export const answer = 42;" },
      { type: "same", line: "" },
    ]);
  });

  test("strips think blocks before deterministic apply", async () => {
    const oldFile = "export const answer = 41;\n";
    const newLazyFile =
      "<think>Need to update the constant first</think>\nexport const answer = 42;\n";

    const { isInstantApply, diffLinesGenerator } = await applyCodeBlock(
      oldFile,
      newLazyFile,
      "answer.ts",
      {} as any,
      new AbortController(),
    );

    expect(isInstantApply).toBe(true);
    expect(deterministicApplyLazyEdit).toHaveBeenCalledWith({
      oldFile,
      newLazyFile: "\nexport const answer = 42;\n",
      filename: "answer.ts",
      onlyFullFileRewrite: true,
    });

    const diffLines = [];
    for await (const diffLine of diffLinesGenerator) {
      diffLines.push(diffLine);
    }
    expect(diffLines).toEqual([
      { type: "old", line: "export const answer = 41;" },
      { type: "new", line: "export const answer = 42;" },
      { type: "same", line: "" },
    ]);
  });

  test("extracts the final Harmony channel before deterministic apply", async () => {
    const oldFile = "export const answer = 41;\n";
    const newLazyFile =
      "<|start|>assistant<|channel|>analysis<|message|>Thinking through the edit<|end|>" +
      "<|start|>assistant<|channel|>final<|message|>export const answer = 42;\n<|end|>";

    const { isInstantApply } = await applyCodeBlock(
      oldFile,
      newLazyFile,
      "answer.ts",
      {} as any,
      new AbortController(),
    );

    expect(isInstantApply).toBe(true);
    expect(deterministicApplyLazyEdit).toHaveBeenCalledWith({
      oldFile,
      newLazyFile: "export const answer = 42;\n",
      filename: "answer.ts",
      onlyFullFileRewrite: true,
    });
  });
});
