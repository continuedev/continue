import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const readMcpResourceTool: Tool = {
  type: "function",
  displayTitle: "Read MCP Resource",
  wouldLikeTo: "read an MCP resource",
  isCurrently: "reading an MCP resource",
  hasAlready: "read an MCP resource",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.ReadMcpResource,
    description: "Read a resource exposed by an MCP server.",
    parameters: {
      type: "object",
      required: ["uri"],
      properties: {
        uri: {
          type: "string",
          description: "The MCP resource URI to read.",
        },
        server: {
          type: "string",
          description:
            "Optional MCP server name or id when the URI is ambiguous.",
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
};
