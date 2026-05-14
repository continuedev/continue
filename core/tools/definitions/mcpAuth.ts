import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const mcpAuthTool: Tool = {
  type: "function",
  displayTitle: "MCP Auth",
  wouldLikeTo: "inspect MCP auth and connection state",
  isCurrently: "inspecting MCP auth and connection state",
  hasAlready: "inspected MCP auth and connection state",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.McpAuth,
    description:
      "Inspect MCP connection and authentication state for configured servers.",
    parameters: {
      type: "object",
      properties: {
        server: {
          type: "string",
          description: "Optional MCP server name or id to inspect.",
        },
      },
      required: [],
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
};
