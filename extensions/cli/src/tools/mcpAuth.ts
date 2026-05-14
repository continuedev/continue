import { services } from "../services/index.js";

import { Tool } from "./types.js";

export const mcpAuthTool: Tool = {
  name: "McpAuth",
  displayName: "McpAuth",
  description:
    "Inspect MCP connection and authentication state for configured servers.",
  readonly: true,
  isBuiltIn: true,
  parameters: {
    type: "object",
    properties: {
      server: {
        type: "string",
        description: "Optional MCP server name to inspect.",
      },
    },
  },
  run: async (args: { server?: string }): Promise<string> => {
    const state = services.mcp.getState();
    const connections = args.server
      ? state.connections.filter(
          (connection) => connection.config.name === args.server,
        )
      : state.connections;

    if (connections.length === 0) {
      return args.server
        ? `No MCP server named ${args.server}.`
        : "No MCP servers configured.";
    }

    return connections
      .map((connection) => {
        const warnings =
          connection.warnings.length > 0
            ? ` warnings=${connection.warnings.join(" | ")}`
            : "";
        return `${connection.config.name}: status=${connection.status} tools=${connection.tools.length} prompts=${connection.prompts.length}${warnings}`;
      })
      .join("\n");
  },
};
