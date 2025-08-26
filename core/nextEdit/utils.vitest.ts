import { describe, expect, test, vi } from "vitest";
import { DiffLine } from "..";
import { NEXT_EDIT_MODELS } from "../llm/constants";
import {
  convertNextEditModelNameToEnum,
  isNextEditTest,
  isWhitespaceOnlyDeletion,
} from "./utils";

describe("isNextEditTest", () => {
  test("returns true when NEXT_EDIT_TEST_ENABLED is 'true'", () => {
    vi.stubEnv("NEXT_EDIT_TEST_ENABLED", "true");
    expect(isNextEditTest()).toBe(true);
  });

  test("returns false when NEXT_EDIT_TEST_ENABLED is 'false'", () => {
    vi.stubEnv("NEXT_EDIT_TEST_ENABLED", "false");
    expect(isNextEditTest()).toBe(false);
  });

  test("returns false when NEXT_EDIT_TEST_ENABLED is undefined", () => {
    vi.stubEnv("NEXT_EDIT_TEST_ENABLED", undefined);
    expect(isNextEditTest()).toBe(false);
  });
});

describe("isWhitespaceOnlyDeletion", () => {
  test("returns true for whitespace-only deletions", () => {
    const diffLines: DiffLine[] = [
      { type: "old", line: "   " },
      { type: "old", line: "\t" },
    ];
    expect(isWhitespaceOnlyDeletion(diffLines)).toBe(true);
  });

  test("returns false for non-whitespace deletions", () => {
    const diffLines: DiffLine[] = [
      { type: "old", line: "code" },
      { type: "old", line: " " },
    ];
    expect(isWhitespaceOnlyDeletion(diffLines)).toBe(false);
  });

  test("returns false for mixed content", () => {
    const diffLines: DiffLine[] = [
      { type: "old", line: "   " },
      { type: "old", line: "code" },
    ];
    expect(isWhitespaceOnlyDeletion(diffLines)).toBe(false);
  });

  test("returns false for mixed type", () => {
    const diffLines: DiffLine[] = [
      { type: "old", line: "   " },
      { type: "new", line: "" },
    ];
    expect(isWhitespaceOnlyDeletion(diffLines)).toBe(false);
  });

  test("returns true for empty array", () => {
    const diffLines: DiffLine[] = [];
    expect(isWhitespaceOnlyDeletion(diffLines)).toBe(true);
  });
});

describe("convertNextEditModelNameToEnum", () => {
  test("returns correct enum for exact matches", () => {
    Object.values(NEXT_EDIT_MODELS).forEach((model) => {
      expect(convertNextEditModelNameToEnum(model)).toBe(model);
    });
  });

  test("returns correct enum when model name is contained in a longer string", () => {
    expect(convertNextEditModelNameToEnum("inception/mercury-coder")).toBe(
      NEXT_EDIT_MODELS.MERCURY_CODER,
    );
    expect(convertNextEditModelNameToEnum("blah/instinct")).toBe(
      NEXT_EDIT_MODELS.INSTINCT,
    );
  });

  test("returns undefined for non-matching model names", () => {
    expect(convertNextEditModelNameToEnum("unknown-model")).toBeUndefined();
    expect(convertNextEditModelNameToEnum("random-string")).toBeUndefined();
    expect(convertNextEditModelNameToEnum("")).toBeUndefined();
  });

  test("returns first match when multiple models could match", () => {
    const modelName = "model-that-contains-multiple-matches";
    const result = convertNextEditModelNameToEnum(modelName);

    if (result !== undefined) {
      expect(Object.values(NEXT_EDIT_MODELS)).toContain(result);
    }
  });
});
