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
    expect(formatToolCall("Write")).toBe("Write");
    expect(formatToolCall("Read", {})).toBe("Read");
    expect(formatToolCall("non_existent_tool", null)).toBe("non_existent_tool");
  });

  it("should format tool name with relative path argument", () => {
    expect(formatToolCall("Write", { filepath: "README.md" })).toBe(
      "Write(README.md)",
    );
    expect(formatToolCall("Read", { filepath: "src/index.ts" })).toBe(
      "Read(src/index.ts)",
    );
  });

  it("should convert absolute paths to relative paths", () => {
    expect(
      formatToolCall("Write", {
        filepath: "/Users/test/project/README.md",
      }),
    ).toBe("Write(README.md)");

    expect(
      formatToolCall("Read", {
        filepath: "/Users/test/project/src/components/App.tsx",
      }),
    ).toBe("Read(src/components/App.tsx)");
  });

  it("should handle absolute paths outside the project", () => {
    expect(formatToolCall("Write", { filepath: "/Users/other/file.txt" })).toBe(
      "Write(../../other/file.txt)",
    );
  });

  it("should handle non-path arguments", () => {
    expect(formatToolCall("Search", { pattern: "TODO" })).toBe("Search(TODO)");
    expect(formatToolCall("Search", { pattern: 123 })).toBe("Search(123)");
  });

  it("should use first argument when multiple are provided", () => {
    expect(
      formatToolCall("Write", {
        filepath: "test.txt",
        content: "Hello world",
      }),
    ).toBe("Write(test.txt)");
  });

  it("should handle multi-line string arguments with ellipsis", () => {
    expect(
      formatToolCall("Bash", {
        command: "echo 'first line'\necho 'second line'\necho 'third line'",
      }),
    ).toBe("Bash(echo 'first line'...)");

    expect(
      formatToolCall("Edit", {
        old_string: "line 1\nline 2\nline 3",
        new_string: "updated content",
      }),
    ).toBe("Edit(line 1...)");

    // Test with empty first line
    expect(
      formatToolCall("Write", {
        content: "\nSecond line\nThird line",
      }),
    ).toBe("Write(...)");
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
      "README.md",
    );
    expect(formatToolArgument("/Users/test/project/src/index.ts")).toBe(
      "src/index.ts",
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
