import { describe, expect, it } from "vitest";
import { Tool, ToolOverride } from "..";
import { applyToolOverrides } from "./applyToolOverrides";

const mockTool = (name: string, description: string): Tool => ({
  type: "function",
  displayTitle: name,
  readonly: true,
  group: "test",
  function: { name, description },
});

describe("applyToolOverrides", () => {
  it("should return tools unchanged when no overrides provided", () => {
    const tools = [mockTool("read_file", "Read a file")];
    const result = applyToolOverrides(tools, undefined);
    expect(result.tools).toEqual(tools);
    expect(result.errors).toHaveLength(0);
  });

  it("should return tools unchanged when empty overrides array provided", () => {
    const tools = [mockTool("read_file", "Read a file")];
    const result = applyToolOverrides(tools, []);
    expect(result.tools).toEqual(tools);
    expect(result.errors).toHaveLength(0);
  });

  it("should override description when specified", () => {
    const tools = [mockTool("read_file", "Original description")];
    const overrides: ToolOverride[] = [
      { name: "read_file", description: "New description" },
    ];
    const result = applyToolOverrides(tools, overrides);
    expect(result.tools[0].function.description).toBe("New description");
    expect(result.errors).toHaveLength(0);
  });

  it("should override displayTitle when specified", () => {
    const tools = [mockTool("read_file", "Read a file")];
    const overrides: ToolOverride[] = [
      { name: "read_file", displayTitle: "Custom Read File" },
    ];
    const result = applyToolOverrides(tools, overrides);
    expect(result.tools[0].displayTitle).toBe("Custom Read File");
  });

  it("should override action phrases when specified", () => {
    const tools = [mockTool("read_file", "Read a file")];
    tools[0].wouldLikeTo = "read {{{ filepath }}}";
    tools[0].isCurrently = "reading {{{ filepath }}}";
    tools[0].hasAlready = "read {{{ filepath }}}";

    const overrides: ToolOverride[] = [
      {
        name: "read_file",
        wouldLikeTo: "open {{{ filepath }}}",
        isCurrently: "opening {{{ filepath }}}",
        hasAlready: "opened {{{ filepath }}}",
      },
    ];
    const result = applyToolOverrides(tools, overrides);
    expect(result.tools[0].wouldLikeTo).toBe("open {{{ filepath }}}");
    expect(result.tools[0].isCurrently).toBe("opening {{{ filepath }}}");
    expect(result.tools[0].hasAlready).toBe("opened {{{ filepath }}}");
  });

  it("should disable tools when disabled: true", () => {
    const tools = [
      mockTool("read_file", "Read"),
      mockTool("write_file", "Write"),
    ];
    const overrides: ToolOverride[] = [{ name: "read_file", disabled: true }];
    const result = applyToolOverrides(tools, overrides);
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].function.name).toBe("write_file");
    expect(result.errors).toHaveLength(0);
  });

  it("should warn when override references unknown tool", () => {
    const tools = [mockTool("read_file", "Read")];
    const overrides: ToolOverride[] = [
      { name: "unknown_tool", description: "test" },
    ];
    const result = applyToolOverrides(tools, overrides);
    expect(result.tools).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("unknown_tool");
    expect(result.errors[0].fatal).toBe(false);
  });

  it("should preserve unmodified fields", () => {
    const tools = [mockTool("read_file", "Original")];
    tools[0].readonly = true;
    tools[0].group = "Built-In";

    const overrides: ToolOverride[] = [
      { name: "read_file", description: "New description" },
    ];
    const result = applyToolOverrides(tools, overrides);
    expect(result.tools[0].readonly).toBe(true);
    expect(result.tools[0].group).toBe("Built-In");
    expect(result.tools[0].displayTitle).toBe("read_file");
  });

  it("should override systemMessageDescription", () => {
    const tools = [mockTool("read_file", "Read")];
    tools[0].systemMessageDescription = {
      prefix: "old prefix",
      exampleArgs: [["filepath", "/old/path"]],
    };

    const overrides: ToolOverride[] = [
      {
        name: "read_file",
        systemMessageDescription: {
          prefix: "new prefix",
          exampleArgs: [["filepath", "/new/path"]],
        },
      },
    ];
    const result = applyToolOverrides(tools, overrides);
    expect(result.tools[0].systemMessageDescription?.prefix).toBe("new prefix");
    expect(result.tools[0].systemMessageDescription?.exampleArgs).toEqual([
      ["filepath", "/new/path"],
    ]);
  });

  it("should partially override systemMessageDescription", () => {
    const tools = [mockTool("read_file", "Read")];
    tools[0].systemMessageDescription = {
      prefix: "old prefix",
      exampleArgs: [["filepath", "/old/path"]],
    };

    const overrides: ToolOverride[] = [
      {
        name: "read_file",
        systemMessageDescription: {
          prefix: "new prefix",
          // exampleArgs not specified - should preserve original
        },
      },
    ];
    const result = applyToolOverrides(tools, overrides);
    expect(result.tools[0].systemMessageDescription?.prefix).toBe("new prefix");
    expect(result.tools[0].systemMessageDescription?.exampleArgs).toEqual([
      ["filepath", "/old/path"],
    ]);
  });

  it("should apply multiple overrides", () => {
    const tools = [
      mockTool("read_file", "Read"),
      mockTool("write_file", "Write"),
      mockTool("delete_file", "Delete"),
    ];

    const overrides: ToolOverride[] = [
      { name: "read_file", description: "Custom read" },
      { name: "write_file", disabled: true },
      { name: "delete_file", displayTitle: "Remove File" },
    ];

    const result = applyToolOverrides(tools, overrides);
    expect(result.tools).toHaveLength(2);
    expect(result.tools[0].function.description).toBe("Custom read");
    expect(result.tools[1].displayTitle).toBe("Remove File");
    expect(result.errors).toHaveLength(0);
  });

  it("description override should also update systemMessageDescription.prefix", () => {
    // Built-in tools have systemMessageDescription set. When a user overrides
    // the description via the simple YAML field, the system message builder
    // uses systemMessageDescription.prefix (not function.description).
    // The description override must fall through to update the prefix.
    const tools = [mockTool("read_file", "Original function description")];
    tools[0].systemMessageDescription = {
      prefix:
        "To read a file with a known filepath, use the read_file tool. For example:",
      exampleArgs: [["filepath", "path/to/file.txt"]],
    };

    const overrides: ToolOverride[] = [
      { name: "read_file", description: "Custom description from YAML config" },
    ];
    const result = applyToolOverrides(tools, overrides);

    // function.description should be updated (existing behavior)
    expect(result.tools[0].function.description).toBe(
      "Custom description from YAML config",
    );

    // FAILS NOW: systemMessageDescription.prefix is NOT updated by description override
    // PASSES AFTER FIX: prefix falls through from description
    expect(result.tools[0].systemMessageDescription?.prefix).toBe(
      "Custom description from YAML config",
    );

    // exampleArgs should be preserved from the original tool
    expect(result.tools[0].systemMessageDescription?.exampleArgs).toEqual([
      ["filepath", "path/to/file.txt"],
    ]);
  });

  it("explicit systemMessageDescription should take priority over description fall-through", () => {
    const tools = [mockTool("read_file", "Original")];
    tools[0].systemMessageDescription = {
      prefix: "Original prefix",
      exampleArgs: [["filepath", "/old/path"]],
    };

    const overrides: ToolOverride[] = [
      {
        name: "read_file",
        description: "Simple description",
        systemMessageDescription: {
          prefix: "Explicit prefix wins",
        },
      },
    ];
    const result = applyToolOverrides(tools, overrides);

    // Explicit systemMessageDescription.prefix should win over description
    expect(result.tools[0].systemMessageDescription?.prefix).toBe(
      "Explicit prefix wins",
    );
    // function.description still gets the simple override
    expect(result.tools[0].function.description).toBe("Simple description");
  });

  it("description override should not add systemMessageDescription to tools that lack it", () => {
    // MCP/dynamic tools don't have systemMessageDescription.
    // A description override should NOT create one.
    const tools = [mockTool("mcp_tool", "Original MCP description")];
    // No systemMessageDescription set

    const overrides: ToolOverride[] = [
      { name: "mcp_tool", description: "Custom MCP description" },
    ];
    const result = applyToolOverrides(tools, overrides);

    expect(result.tools[0].function.description).toBe(
      "Custom MCP description",
    );
    // Should remain undefined — don't promote a dynamic tool to predefined
    expect(result.tools[0].systemMessageDescription).toBeUndefined();
  });

  it("should not mutate original tools array", () => {
    const tools = [mockTool("read_file", "Original")];
    const originalDescription = tools[0].function.description;

    const overrides: ToolOverride[] = [
      { name: "read_file", description: "New description" },
    ];
    const result = applyToolOverrides(tools, overrides);

    // Original should be unchanged
    expect(tools[0].function.description).toBe(originalDescription);
    // Result should have new description
    expect(result.tools[0].function.description).toBe("New description");
  });
});
