import type { ChatCompletionToolChoiceOption } from "openai/resources/index.js";
import { describe, expect, test } from "vitest";
import { convertToolChoiceToVercel } from "../convertToolChoiceToVercel.js";

describe("convertToolChoiceToVercel", () => {
  test("returns undefined for undefined input", () => {
    const result = convertToolChoiceToVercel(undefined);
    expect(result).toBeUndefined();
  });

  test("returns 'auto' for string 'auto'", () => {
    const result = convertToolChoiceToVercel("auto");
    expect(result).toBe("auto");
  });

  test("returns 'none' for string 'none'", () => {
    const result = convertToolChoiceToVercel("none");
    expect(result).toBe("none");
  });

  test("returns 'required' for string 'required'", () => {
    const result = convertToolChoiceToVercel("required");
    expect(result).toBe("required");
  });

  test("converts function object to tool format", () => {
    const toolChoice: ChatCompletionToolChoiceOption = {
      type: "function",
      function: {
        name: "readFile",
      },
    };

    const result = convertToolChoiceToVercel(toolChoice);

    expect(result).toEqual({
      type: "tool",
      toolName: "readFile",
    });
  });

  test("converts function object with different tool name", () => {
    const toolChoice: ChatCompletionToolChoiceOption = {
      type: "function",
      function: {
        name: "writeFile",
      },
    };

    const result = convertToolChoiceToVercel(toolChoice);

    expect(result).toEqual({
      type: "tool",
      toolName: "writeFile",
    });
  });

  test("returns undefined for unknown object format", () => {
    // Simulate an unknown object type
    const toolChoice = {
      type: "unknown_type",
      data: "something",
    } as unknown as ChatCompletionToolChoiceOption;

    const result = convertToolChoiceToVercel(toolChoice);

    expect(result).toBeUndefined();
  });
});
