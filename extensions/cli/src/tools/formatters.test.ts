import { render } from "ink-testing-library";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    const writeResult = render(
      React.createElement(() => formatToolCall("Write") as React.ReactElement),
    );
    expect(writeResult.lastFrame()).toBe("Write");

    const readResult = render(
      React.createElement(
        () => formatToolCall("Read", {}) as React.ReactElement,
      ),
    );
    expect(readResult.lastFrame()).toBe("Read");

    const nonExistentResult = render(
      React.createElement(
        () => formatToolCall("non_existent_tool", null) as React.ReactElement,
      ),
    );
    expect(nonExistentResult.lastFrame()).toBe("non_existent_tool");
  });

  it("should format tool name with relative path argument", () => {
    const writeResult = render(
      React.createElement(
        () =>
          formatToolCall("Write", {
            filepath: "README.md",
          }) as React.ReactElement,
      ),
    );
    expect(writeResult.lastFrame()).toBe("Write(README.md)");

    const readResult = render(
      React.createElement(
        () =>
          formatToolCall("Read", {
            filepath: "src/index.ts",
          }) as React.ReactElement,
      ),
    );
    expect(readResult.lastFrame()).toBe("Read(src/index.ts)");
  });

  it("should convert absolute paths to relative paths", () => {
    const writeResult = render(
      React.createElement(
        () =>
          formatToolCall("Write", {
            filepath: "/Users/test/project/README.md",
          }) as React.ReactElement,
      ),
    );
    expect(writeResult.lastFrame()).toBe("Write(README.md)");

    const readResult = render(
      React.createElement(
        () =>
          formatToolCall("Read", {
            filepath: "/Users/test/project/src/components/App.tsx",
          }) as React.ReactElement,
      ),
    );
    expect(readResult.lastFrame()).toBe("Read(src/components/App.tsx)");
  });

  it("should handle absolute paths outside the project", () => {
    const result = render(
      React.createElement(
        () =>
          formatToolCall("Write", {
            filepath: "/Users/other/file.txt",
          }) as React.ReactElement,
      ),
    );
    expect(result.lastFrame()).toBe("Write(../../other/file.txt)");
  });

  it("should handle non-path arguments", () => {
    const stringResult = render(
      React.createElement(
        () =>
          formatToolCall("Search", { pattern: "TODO" }) as React.ReactElement,
      ),
    );
    expect(stringResult.lastFrame()).toBe("Search(TODO)");

    const numberResult = render(
      React.createElement(
        () => formatToolCall("Search", { pattern: 123 }) as React.ReactElement,
      ),
    );
    expect(numberResult.lastFrame()).toBe("Search(123)");
  });

  it("should use first argument when multiple are provided", () => {
    const result = render(
      React.createElement(
        () =>
          formatToolCall("Write", {
            filepath: "test.txt",
            content: "Hello world",
          }) as React.ReactElement,
      ),
    );
    expect(result.lastFrame()).toBe("Write(test.txt)");
  });

  it("should handle multi-line string arguments with ellipsis", () => {
    const bashResult = render(
      React.createElement(
        () =>
          formatToolCall("Bash", {
            command: "echo 'first line'\necho 'second line'\necho 'third line'",
          }) as React.ReactElement,
      ),
    );
    expect(bashResult.lastFrame()).toBe("Bash(echo 'first line'...)");

    const editResult = render(
      React.createElement(
        () =>
          formatToolCall("Edit", {
            old_string: "line 1\nline 2\nline 3",
            new_string: "updated content",
          }) as React.ReactElement,
      ),
    );
    expect(editResult.lastFrame()).toBe("Edit(line 1...)");

    // Test with empty first line
    const writeResult = render(
      React.createElement(
        () =>
          formatToolCall("Write", {
            content: "\nSecond line\nThird line",
          }) as React.ReactElement,
      ),
    );
    expect(writeResult.lastFrame()).toBe("Write(...)");
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
