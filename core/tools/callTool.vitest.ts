import { beforeEach, describe, expect, it, vi } from "vitest";
import { Tool, ToolExtras } from "..";

const { mcpCallTool } = vi.hoisted(() => ({ mcpCallTool: vi.fn() }));

vi.mock("../context/mcp/MCPManagerSingleton", () => ({
  MCPManagerSingleton: {
    getInstance: () => ({
      getConnection: () => ({
        client: { callTool: mcpCallTool },
        options: { timeout: 1000 },
      }),
    }),
  },
}));

import { callTool, encodeMCPToolUri } from "./callTool";

describe("callTool with MCP tools", () => {
  const tool: Tool = {
    type: "function",
    displayTitle: "filesystem edit_file",
    readonly: false,
    group: "filesystem",
    uri: encodeMCPToolUri("filesystem", "edit_file"),
    function: {
      name: "filesystem_edit_file",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          edits: { type: "array", items: { type: "object" } },
          dryRun: { type: "boolean" },
        },
        required: ["path", "edits"],
      },
    },
  };

  beforeEach(() => {
    mcpCallTool.mockReset();
    mcpCallTool.mockResolvedValue({ content: [{ type: "text", text: "ok" }] });
  });

  it("should send schema-typed arguments for sequential tool calls", async () => {
    const rawArgs = [
      // Arrays and booleans serialized as JSON text, as in #13350
      '{"path": "a.ts", "edits": "[{\\"oldText\\": \\"a\\", \\"newText\\": \\"b\\"}]", "dryRun": "false"}',
      '{"path": "b.ts", "edits": [{"oldText": "c", "newText": "d"}], "dryRun": true}',
      '{"path": "[c].ts", "edits": "[]"}',
    ];
    for (const [i, args] of rawArgs.entries()) {
      const result = await callTool(
        tool,
        {
          id: `call-${i}`,
          type: "function",
          function: { name: tool.function.name, arguments: args },
        },
        { tool } as unknown as ToolExtras,
      );
      expect(result.errorMessage).toBeUndefined();
    }

    expect(mcpCallTool.mock.calls.map(([params]) => params)).toEqual([
      {
        name: "edit_file",
        arguments: {
          path: "a.ts",
          edits: [{ oldText: "a", newText: "b" }],
          dryRun: false,
        },
      },
      {
        name: "edit_file",
        arguments: {
          path: "b.ts",
          edits: [{ oldText: "c", newText: "d" }],
          dryRun: true,
        },
      },
      { name: "edit_file", arguments: { path: "[c].ts", edits: [] } },
    ]);
  });
});
