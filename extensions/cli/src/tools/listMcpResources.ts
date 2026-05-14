import { services } from "../services/index.js";

import { Tool } from "./types.js";

export const listMcpResourcesTool: Tool = {
  name: "ListMcpResources",
  displayName: "ListMcpResources",
  description: "List resources exposed by connected MCP servers.",
  readonly: true,
  isBuiltIn: true,
  parameters: {
    type: "object",
    properties: {
      server: {
        type: "string",
        description: "Optional MCP server name to filter by.",
      },
    },
  },
  run: async (args: { server?: string }): Promise<string> => {
    const resources = await services.mcp.listResources(args.server);
    if (resources.length === 0) {
      return "No MCP resources found.";
    }

    return resources
      .map(
        (resource) =>
          `${resource.server}: ${resource.uri}${resource.name ? ` (${resource.name})` : ""}`,
      )
      .join("\n");
  },
};
