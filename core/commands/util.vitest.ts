import { describe, expect, it } from "vitest";
import { ContextItemWithId, RangeInFileWithContents } from "../index";
import { ctxItemToRifWithContents } from "./util";

describe("ctxItemToRifWithContents", () => {
  it("should parse start and end lines from the item name when format is valid", () => {
    const item: ContextItemWithId = {
      id: { providerTitle: "testProvider", itemId: "1" },
      name: "myFunction(10-20)",
      content: "function content",
      description: "test description",
      uri: { type: "file", value: "/path/to/file" },
    };

    const expected: RangeInFileWithContents = {
      filepath: "/path/to/file",
      range: {
        start: { line: 10, character: 0 },
        end: { line: 20, character: 0 },
      },
      contents: "function content",
    };

    const result = ctxItemToRifWithContents(item);
    expect(result).toEqual(expected);
  });

  it("should set startLine and endLine to 0 when name format is invalid", () => {
    const item: ContextItemWithId = {
      id: { providerTitle: "testProvider", itemId: "2" },
      name: "myFunction",
      content: "function content",
      description: "test description",
      uri: { type: "file", value: "/path/to/file" },
    };

    const expected: RangeInFileWithContents = {
      filepath: "/path/to/file",
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
      contents: "function content",
    };

    const result = ctxItemToRifWithContents(item);
    expect(result).toEqual(expected);
  });

  it("should handle missing uri by setting filepath to empty string", () => {
    const item: ContextItemWithId = {
      id: { providerTitle: "testProvider", itemId: "3" },
      name: "myFunction(10-20)",
      content: "function content",
      description: "test description",
    };

    const expected: RangeInFileWithContents = {
      filepath: "",
      range: {
        start: { line: 10, character: 0 },
        end: { line: 20, character: 0 },
      },
      contents: "function content",
    };

    const result = ctxItemToRifWithContents(item);
    expect(result).toEqual(expected);
  });

  it("should handle uri with undefined value by setting filepath to empty string", () => {
    const item: ContextItemWithId = {
      id: { providerTitle: "testProvider", itemId: "4" },
      name: "myFunction(10-20)",
      content: "function content",
      description: "test description",
    };

    const expected: RangeInFileWithContents = {
      filepath: "",
      range: {
        start: { line: 10, character: 0 },
        end: { line: 20, character: 0 },
      },
      contents: "function content",
    };

    const result = ctxItemToRifWithContents(item);
    expect(result).toEqual(expected);
  });

  it("should handle invalid line numbers gracefully", () => {
    const item: ContextItemWithId = {
      id: { providerTitle: "testProvider", itemId: "6" },
      name: "myFunction(invalid-lines)",
      content: "function content",
      description: "test description",
      uri: { type: "file", value: "/path/to/file" },
    };

    const result = ctxItemToRifWithContents(item);

    expect(result.range.start.line).toBeNaN();
    expect(result.range.end.line).toBeNaN();
  });

  it("should handle missing closing parenthesis in name", () => {
    const item: ContextItemWithId = {
      id: { providerTitle: "testProvider", itemId: "7" },
      name: "myFunction(10-20",
      content: "function content",
      description: "test description",
      uri: { type: "file", value: "/path/to/file" },
    };

    const expected: RangeInFileWithContents = {
      filepath: "/path/to/file",
      range: {
        start: { line: 10, character: 0 },
        end: { line: 20, character: 0 },
      },
      contents: "function content",
    };

    const result = ctxItemToRifWithContents(item);
    expect(result).toEqual(expected);
  });

  it("should handle name with multiple '-' characters", () => {
    const item: ContextItemWithId = {
      id: { providerTitle: "testProvider", itemId: "8" },
      name: "myFunction(10-20-30)",
      content: "function content",
      description: "test description",
      uri: { type: "file", value: "/path/to/file" },
    };

    const expected: RangeInFileWithContents = {
      filepath: "/path/to/file",
      range: {
        start: { line: 10, character: 0 },
        end: { line: 20, character: 0 },
      },
      contents: "function content",
    };

    const result = ctxItemToRifWithContents(item);
    expect(result).toEqual(expected);
  });
});
