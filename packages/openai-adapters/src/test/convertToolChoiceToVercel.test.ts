import { describe, expect, test } from "vitest";
import { convertToolChoiceToVercel } from "../convertToolChoiceToVercel.js";

describe("convertToolChoiceToVercel", () => {
  describe("undefined input", () => {
    test("returns undefined for undefined input", () => {
      const result = convertToolChoiceToVercel(undefined);
      expect(result).toBeUndefined();
    });
  });

  describe("string values", () => {
    test("passes through 'auto' string", () => {
      const result = convertToolChoiceToVercel("auto");
      expect(result).toBe("auto");
    });

    test("passes through 'none' string", () => {
      const result = convertToolChoiceToVercel("none");
      expect(result).toBe("none");
    });

    test("passes through 'required' string", () => {
      const result = convertToolChoiceToVercel("required");
      expect(result).toBe("required");
    });
  });

  describe("object format conversion", () => {
    test("converts function type object to tool format", () => {
      const result = convertToolChoiceToVercel({
        type: "function",
        function: { name: "myTool" },
      });

      expect(result).toEqual({
        type: "tool",
        toolName: "myTool",
      });
    });

    test("converts function type with complex name", () => {
      const result = convertToolChoiceToVercel({
        type: "function",
        function: { name: "read_file_contents" },
      });

      expect(result).toEqual({
        type: "tool",
        toolName: "read_file_contents",
      });
    });
  });

  describe("edge cases", () => {
    test("returns undefined for unknown object format", () => {
      // Cast to any to test unknown format handling
      const result = convertToolChoiceToVercel({
        type: "unknown",
        function: { name: "test" },
      } as any);

      expect(result).toBeUndefined();
    });
  });
});
