import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const listMcpResourcesTool: Tool = {
  type: "function",
  displayTitle: "List MCP Resources",
  wouldLikeTo: "list MCP resources",
  isCurrently: "listing MCP resources",
  hasAlready: "listed MCP resources",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.ListMcpResources,
    description: "List resources exposed by connected MCP servers.",
    parameters: {
      type: "object",
      properties: {
        server: {
          type: "string",
          description: "Optional MCP server name or id to filter by.",
        },
      },
      required: [],
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
};
