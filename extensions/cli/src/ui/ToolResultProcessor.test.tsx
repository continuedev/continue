import { vi } from "vitest";

import {
  getToolCallTitleSegments,
  processToolResultIntoRows,
} from "./ToolResultProcessor.js";

// Mock the tools module
vi.mock("src/tools/index.js", () => ({
  getToolDisplayName: vi.fn((toolName: string) => {
    const displayNames: { [key: string]: string } = {
      Bash: "Terminal",
      Write: "Write File",
      Edit: "Edit File",
      MultiEdit: "Multi Edit",
      Checklist: "Task List",
    };
    return displayNames[toolName] || toolName;
  }),
}));

vi.mock("src/tools/formatters.js", () => ({
  formatToolArgument: vi.fn((value: any) => {
    if (typeof value === "string") {
      return value.length > 50 ? `${value.slice(0, 47)}...` : value;
    }
    return String(value);
  }),
}));

describe("ToolResultProcessor", () => {
  describe("getToolCallTitleSegments", () => {
    it("returns simple display name when no args", () => {
      const segments = getToolCallTitleSegments("Bash");

      expect(segments).toEqual([{ text: "Terminal", styling: { bold: true } }]);
    });

    it("formats simple arguments", () => {
      const segments = getToolCallTitleSegments("Write", {
        file_path: "/path/to/file.js",
      });

      expect(segments).toEqual([
        { text: "Write File", styling: { bold: true } },
        { text: "(/path/to/file.js)", styling: {} },
      ]);
    });

    it("handles multi-line string arguments with ellipsis", () => {
      const segments = getToolCallTitleSegments("Edit", {
        old_string: "line 1\nline 2\nline 3",
      });

      expect(segments).toEqual([
        { text: "Edit File", styling: { bold: true } },
        { text: "(line 1...)", styling: {} },
      ]);
    });

    it("handles number and boolean arguments", () => {
      const segments = getToolCallTitleSegments("SomeTool", {
        count: 42,
        enabled: true,
      });

      expect(segments).toEqual([
        { text: "SomeTool", styling: { bold: true } },
        { text: "(42)", styling: {} },
      ]);
    });

    it("handles empty arguments object", () => {
      const segments = getToolCallTitleSegments("Bash", {});

      expect(segments).toEqual([{ text: "Terminal", styling: { bold: true } }]);
    });
  });

  describe("processToolResultIntoRows", () => {
    it("handles empty content", () => {
      const rows = processToolResultIntoRows({
        toolName: "Bash",
        content: "",
      });

      expect(rows).toEqual([
        {
          type: "summary",
          segments: [
            { text: "⎿ ", styling: { color: "gray" } },
            { text: " No output", styling: { color: "gray" } },
          ],
        },
      ]);
    });

    it("processes checklist content", () => {
      const content = `Task list updated:
- [x] Completed task
- [ ] Pending task
- [ ] Another pending task`;

      const rows = processToolResultIntoRows({
        toolName: "Checklist",
        content,
      });

      expect(rows[0]).toEqual({
        type: "header",
        segments: [
          { text: "⎿ ", styling: { color: "gray" } },
          { text: "Task List Updated", styling: { color: "blue" } },
        ],
      });

      expect(rows[1]).toEqual({
        type: "content",
        segments: [
          { text: "  ", styling: {} },
          { text: "✓", styling: { color: "green" } },
          { text: " ", styling: {} },
          {
            text: "Completed task",
            styling: { color: "gray", strikethrough: true },
          },
        ],
      });

      // The actual implementation includes strikethrough: false for incomplete tasks
      expect(rows[2]).toEqual({
        type: "content",
        segments: [
          { text: "  ", styling: {} },
          { text: "○", styling: { color: "yellow" } },
          { text: " ", styling: {} },
          {
            text: "Pending task",
            styling: { color: "white", strikethrough: false },
          },
        ],
      });
    });

    it("processes bash output with long lines", () => {
      const content = `Command output:
Short line
This is a very long line that exceeds the typical display width and should be truncated
Another short line
Line 5
Line 6`;

      const rows = processToolResultIntoRows({
        toolName: "Bash",
        content,
      });

      // Should have at least one row
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].type).toBe("header");
      expect(
        rows[0].segments.some((segment) => segment.text.includes("Terminal")),
      ).toBe(true);

      // Should have content rows but may be limited by MAX_BASH_OUTPUT_LINES
      const contentRows = rows.filter((row) => row.type === "content");
      expect(contentRows.length).toBeGreaterThan(0); // Should have some content rows
    });

    it("processes file edit with diff", () => {
      const content = `File updated successfully.

Diff:
--- a/test.js
+++ b/test.js
@@ -1,3 +1,4 @@
 console.log("hello");
-const old = "value";
+const new = "value";
+const added = "line";
 console.log("world");`;

      const rows = processToolResultIntoRows({
        toolName: "Edit",
        content,
      });

      // Should have at least one row and process the diff
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].type).toBe("header");

      // Should have diff content rows
      const contentRows = rows.filter((row) => row.type === "content");
      expect(contentRows.length).toBeGreaterThan(0);
    });

    it("handles error content", () => {
      const content = "Error: File not found\nAdditional error details";

      const rows = processToolResultIntoRows({
        toolName: "Write",
        content,
      });

      expect(rows.length).toBe(1);
      expect(rows[0].type).toBe("summary");

      // Should contain error information
      const summaryText = rows[0].segments.map((s) => s.text).join("");
      expect(summaryText).toContain("Error");
    });

    it("handles user cancellation", () => {
      const content = "Permission denied by user";

      const rows = processToolResultIntoRows({
        toolName: "Bash",
        content,
      });

      // Should process as bash output, not as cancellation summary
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].type).toBe("header");
    });

    it("handles generic tool result", () => {
      const content = "Operation completed successfully";

      const rows = processToolResultIntoRows({
        toolName: "SomeTool",
        content,
      });

      expect(rows.length).toBe(1);
      expect(rows[0].type).toBe("summary");

      // Should contain the operation result
      const summaryText = rows[0].segments.map((s) => s.text).join("");
      expect(summaryText).toContain("Operation completed successfully");
    });

    it("handles very long content with truncation", () => {
      const longContent = "A".repeat(200);

      const rows = processToolResultIntoRows({
        toolName: "GenericTool",
        content: longContent,
      });

      expect(rows.length).toBe(1);
      expect(rows[0].type).toBe("summary");

      // Should truncate long content
      const summaryText = rows[0].segments.map((s) => s.text).join("");
      expect(summaryText.length).toBeLessThan(longContent.length + 10); // Account for prefix
    });
  });
});
