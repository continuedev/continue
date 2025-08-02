import { vi } from "vitest";
import { formatToolArgument } from "./formatters.js";
import { formatToolCall } from "./index.js";

describe("formatToolCall", () => {
  beforeEach(() => {
    // Mock process.cwd to return a consistent value
    vi.spyOn(process, "cwd").mockReturnValue("/Users/test/project");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should format tool name without arguments", () => {
    expect(formatToolCall("write_file")).toBe("Write");
    expect(formatToolCall("read_file", {})).toBe("Read");
    expect(formatToolCall("non_existent_tool", null)).toBe("non_existent_tool");
  });

  it("should format tool name with relative path argument", () => {
    expect(formatToolCall("write_file", { filepath: "README.md" })).toBe(
      "Write(README.md)"
    );
    expect(formatToolCall("read_file", { filepath: "src/index.ts" })).toBe(
      "Read(src/index.ts)"
    );
  });

  it("should convert absolute paths to relative paths", () => {
    expect(
      formatToolCall("write_file", {
        filepath: "/Users/test/project/README.md",
      })
    ).toBe("Write(README.md)");

    expect(
      formatToolCall("read_file", {
        filepath: "/Users/test/project/src/components/App.tsx",
      })
    ).toBe("Read(src/components/App.tsx)");
  });

  it("should handle absolute paths outside the project", () => {
    expect(
      formatToolCall("write_file", { filepath: "/Users/other/file.txt" })
    ).toBe("Write(../../other/file.txt)");
  });

  it("should handle non-path arguments", () => {
    expect(formatToolCall("search_code", { pattern: "TODO" })).toBe(
      "Search(TODO)"
    );
    expect(formatToolCall("search_code", { pattern: 123 })).toBe("Search(123)");
  });

  it("should use first argument when multiple are provided", () => {
    expect(
      formatToolCall("write_file", {
        filepath: "test.txt",
        content: "Hello world",
      })
    ).toBe("Write(test.txt)");
  });
});

describe("formatToolArgument", () => {
  beforeEach(() => {
    vi.spyOn(process, "cwd").mockReturnValue("/Users/test/project");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return empty string for null/undefined", () => {
    expect(formatToolArgument(null)).toBe("");
    expect(formatToolArgument(undefined)).toBe("");
  });

  it("should convert absolute paths to relative", () => {
    expect(formatToolArgument("/Users/test/project/README.md")).toBe(
      "README.md"
    );
    expect(formatToolArgument("/Users/test/project/src/index.ts")).toBe(
      "src/index.ts"
    );
  });

  it("should preserve relative paths", () => {
    expect(formatToolArgument("README.md")).toBe("README.md");
    expect(formatToolArgument("./src/index.ts")).toBe("./src/index.ts");
  });

  it("should handle non-string values", () => {
    expect(formatToolArgument(123)).toBe("123");
    expect(formatToolArgument(true)).toBe("true");
    expect(formatToolArgument({ key: "value" })).toBe("[object Object]");
  });
});
