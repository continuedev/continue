// core/tools/definitions/memory.vitest.ts
import { describe, expect, it } from "vitest";
import { BuiltInToolNames } from "../builtIn.js";
import { memoryTool } from "./memory.js";

describe("memoryTool definition", () => {
  describe("metadata", () => {
    it("should have correct tool type for Anthropic", () => {
      expect(memoryTool.type).toBe("function");
      expect(memoryTool.function.type).toBe("memory_20250818");
    });

    it("should have correct tool name", () => {
      expect(memoryTool.function.name).toBe(BuiltInToolNames.Memory);
      expect(memoryTool.function.name).toBe("memory");
    });

    it("should have descriptive titles", () => {
      expect(memoryTool.displayTitle).toBe("Memory");
      expect(memoryTool.function.description).toContain("claude memory tool");
    });

    it("should be marked as not readonly", () => {
      expect(memoryTool.readonly).toBe(false);
    });

    it("should have default policy of allowedWithoutPermission", () => {
      expect(memoryTool.defaultToolPolicy).toBe("allowedWithoutPermission");
    });

    it("should have appropriate icon", () => {
      expect(memoryTool.toolCallIcon).toBe("ArchiveBoxIcon");
    });
  });

  describe("function parameters", () => {
    it("should require command parameter", () => {
      expect(memoryTool.function.parameters!.required).toContain("command");
    });

    it("should have command enum with all operations", () => {
      const commandProperty = memoryTool.function.parameters!.properties.command;
      expect(commandProperty.type).toBe("string");
      expect(commandProperty.enum).toEqual([
        "view",
        "create",
        "insert",
        "str_replace",
        "delete",
        "rename",
      ]);
    });

    it("should have path parameter with proper description", () => {
      const pathProperty = memoryTool.function.parameters!.properties.path;
      expect(pathProperty).toBeDefined();
      expect(pathProperty.type).toBe("string");
      expect(pathProperty.description).toContain("/memories");
    });

    it("should have view_range parameter for viewing files", () => {
      const viewRangeProperty =
        memoryTool.function.parameters!.properties.view_range;
      expect(viewRangeProperty).toBeDefined();
      expect(viewRangeProperty.type).toBe("array");
      expect(viewRangeProperty.items.type).toBe("number");
      expect(viewRangeProperty.description).toContain("line range");
    });

    it("should have file_text parameter for create command", () => {
      const fileTextProperty =
        memoryTool.function.parameters!.properties.file_text;
      expect(fileTextProperty).toBeDefined();
      expect(fileTextProperty.type).toBe("string");
      expect(fileTextProperty.description).toContain("creating");
    });

    it("should have insert parameters", () => {
      const insertLineProperty =
        memoryTool.function.parameters!.properties.insert_line;
      const insertTextProperty =
        memoryTool.function.parameters!.properties.insert_text;

      expect(insertLineProperty).toBeDefined();
      expect(insertLineProperty.type).toBe("number");
      expect(insertLineProperty.description).toContain("0-based");

      expect(insertTextProperty).toBeDefined();
      expect(insertTextProperty.type).toBe("string");
    });

    it("should have str_replace parameters", () => {
      const oldStrProperty = memoryTool.function.parameters!.properties.old_str;
      const newStrProperty = memoryTool.function.parameters!.properties.new_str;

      expect(oldStrProperty).toBeDefined();
      expect(oldStrProperty.type).toBe("string");
      expect(oldStrProperty.description).toContain("exactly once");

      expect(newStrProperty).toBeDefined();
      expect(newStrProperty.type).toBe("string");
      expect(newStrProperty.description.toLowerCase()).toContain("replacement");
    });

    it("should have rename parameters", () => {
      const oldPathProperty =
        memoryTool.function.parameters!.properties.old_path;
      const newPathProperty =
        memoryTool.function.parameters!.properties.new_path;

      expect(oldPathProperty).toBeDefined();
      expect(oldPathProperty.type).toBe("string");
      expect(oldPathProperty.description).toContain("rename");

      expect(newPathProperty).toBeDefined();
      expect(newPathProperty.type).toBe("string");
      expect(newPathProperty.description).toContain("rename");
    });
  });

  describe("system message description", () => {
    it("should have prefix explaining memory usage", () => {
      expect(memoryTool.systemMessageDescription).toBeDefined();
      expect(memoryTool.systemMessageDescription?.prefix).toContain(
        "long-term memories",
      );
      expect(memoryTool.systemMessageDescription?.prefix).toContain(
        "/memories",
      );
    });

    it("should have example args", () => {
      expect(memoryTool.systemMessageDescription?.exampleArgs).toBeDefined();
      expect(memoryTool.systemMessageDescription?.exampleArgs).toEqual([
        ["command", "view"],
        ["path", "/memories/index.md"],
      ]);
    });
  });

  describe("template strings", () => {
    it("should have wouldLikeTo template", () => {
      expect(memoryTool.wouldLikeTo).toBeDefined();
      expect(memoryTool.wouldLikeTo).toContain("{{{ command }}}");
      expect(memoryTool.wouldLikeTo).toContain("{{{ path }}}");
    });

    it("should have isCurrently template", () => {
      expect(memoryTool.isCurrently).toBeDefined();
      expect(memoryTool.isCurrently).toContain("{{{ command }}}");
      expect(memoryTool.isCurrently).toContain("{{{ path }}}");
    });

    it("should have hasAlready template", () => {
      expect(memoryTool.hasAlready).toBeDefined();
      expect(memoryTool.hasAlready).toContain("{{{ command }}}");
      expect(memoryTool.hasAlready).toContain("{{{ path }}}");
    });
  });

  describe("tool structure validation", () => {
    it("should have valid OpenAI function calling structure", () => {
      expect(memoryTool.function).toMatchObject({
        name: expect.any(String),
        description: expect.any(String),
        parameters: {
          type: "object",
          required: expect.any(Array),
          properties: expect.any(Object),
        },
      });
    });

    it("should have all command operations documented", () => {
      const commands = [
        "view",
        "create",
        "insert",
        "str_replace",
        "delete",
        "rename",
      ];
      const commandEnum =
        memoryTool.function.parameters!.properties.command.enum;

      for (const cmd of commands) {
        expect(commandEnum).toContain(cmd);
      }
    });

    it("should have parameters for all documented commands", () => {
      const properties = memoryTool.function.parameters!.properties;

      // Check that we have parameters for each command type
      expect(properties).toHaveProperty("command"); // All commands
      expect(properties).toHaveProperty("path"); // Most commands
      expect(properties).toHaveProperty("view_range"); // view command
      expect(properties).toHaveProperty("file_text"); // create command
      expect(properties).toHaveProperty("insert_line"); // insert command
      expect(properties).toHaveProperty("insert_text"); // insert command
      expect(properties).toHaveProperty("old_str"); // str_replace command
      expect(properties).toHaveProperty("new_str"); // str_replace command
      expect(properties).toHaveProperty("old_path"); // rename command
      expect(properties).toHaveProperty("new_path"); // rename command
    });
  });

  describe("Anthropic compatibility", () => {
    it("should use Anthropic memory tool type", () => {
      // Anthropic expects type "memory_20250818" for their memory tool
      expect(memoryTool.function.type).toBe("memory_20250818");
    });

    it("should have minimal description for Anthropic", () => {
      // Anthropic's memory tool uses a simple description
      expect(memoryTool.function.description).toBe(
        "Anthropic claude memory tool",
      );
    });

    it("should have command as first required parameter", () => {
      const required = memoryTool.function.parameters!.required;
      expect(required).toHaveLength(1);
      expect(required[0]).toBe("command");
    });

    it("should document that it is only available on Claude 4+ models", () => {
      // Memory tool is only available on specific Claude 4+ models:
      // - Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)
      // - Claude Sonnet 4 (claude-sonnet-4-20250514)
      // - Claude Haiku 4.5 (claude-haiku-4-5-20251001)
      // - Claude Opus 4.1 (claude-opus-4-1-20250805)
      // - Claude Opus 4 (claude-opus-4-20250514)
      // This is enforced in core/tools/index.ts via supportsMemoryTool()
      expect(memoryTool.function.type).toBe("memory_20250818");
      expect(memoryTool.function.description).toContain("claude");
    });
  });

  describe("security and validation", () => {
    it("should document path requirements in description", () => {
      const pathProperty = memoryTool.function.parameters!.properties.path;
      expect(pathProperty.description).toContain("/memories");
      expect(pathProperty.description).toContain("Must begin");
    });

    it("should document str_replace uniqueness requirement", () => {
      const oldStrProperty = memoryTool.function.parameters!.properties.old_str;
      expect(oldStrProperty.description).toContain("exactly once");
    });

    it("should document insert_line as 0-based", () => {
      const insertLineProperty =
        memoryTool.function.parameters!.properties.insert_line;
      expect(insertLineProperty.description).toContain("0-based");
    });

    it("should document view_range as 1-indexed", () => {
      const viewRangeProperty =
        memoryTool.function.parameters!.properties.view_range;
      expect(viewRangeProperty.description).toContain("1-indexed");
    });

    it("should document -1 for EOF in view_range", () => {
      const viewRangeProperty =
        memoryTool.function.parameters!.properties.view_range;
      expect(viewRangeProperty.description).toContain("-1");
      expect(viewRangeProperty.description).toContain("EOF");
    });
  });
});
