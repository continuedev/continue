import { describe, expect, it } from "vitest";

import type { Tool, ToolExtras } from "../..";

import { toolSearchImpl } from "./toolSearch";

function createTool(name: string, description: string): Tool {
  return {
    type: "function",
    displayTitle: name,
    readonly: true,
    isInstant: true,
    group: "Built-In",
    function: {
      name,
      description,
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  };
}

function createExtras(tools: Tool[]): ToolExtras {
  return {
    ide: {} as any,
    llm: {} as any,
    fetch: (() => {
      throw new Error("unused");
    }) as any,
    tool: createTool("tool_search", "Search tools"),
    config: {} as any,
    availableTools: tools,
  } as ToolExtras & { availableTools: Tool[] };
}

describe("toolSearchImpl", () => {
  const tools = [
    createTool("grep_search", "Search repository contents with regex"),
    createTool("todo_write", "Update a structured todo list"),
    createTool("run_terminal_command", "Run a shell command in the workspace"),
  ];

  it("returns ranked keyword matches", async () => {
    const result = await toolSearchImpl(
      { query: "grep", max_results: 5 },
      createExtras(tools),
    );

    expect(result[0]?.content).toContain(
      'Found 1 tool(s) matching "grep" (3 total available):',
    );
    expect(result[0]?.content).toContain(
      "- **grep_search**: Search repository contents with regex",
    );
  });

  it("returns full schema details for select queries", async () => {
    const result = await toolSearchImpl(
      { query: "select:todo_write" },
      createExtras(tools),
    );

    expect(result[0]?.content).toContain("## todo_write");
    expect(result[0]?.content).toContain("Update a structured todo list");
    expect(result[0]?.content).toContain("Parameters:");
  });

  it("supports required terms and reports misses cleanly", async () => {
    const match = await toolSearchImpl(
      { query: "+todo list" },
      createExtras(tools),
    );
    const miss = await toolSearchImpl(
      { query: "+github issues" },
      createExtras(tools),
    );

    expect(match[0]?.content).toContain("todo_write");
    expect(miss[0]?.content).toContain('No tools matched "+github issues".');
  });
});
