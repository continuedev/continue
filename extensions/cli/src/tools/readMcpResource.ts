import { services } from "../services/index.js";

import { Tool } from "./types.js";

export const readMcpResourceTool: Tool = {
  name: "ReadMcpResource",
  displayName: "ReadMcpResource",
  description: "Read a resource exposed by an MCP server.",
  readonly: true,
  isBuiltIn: true,
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
        description: "Optional MCP server name when the URI is ambiguous.",
      },
    },
  },
  run: async (args: { uri: string; server?: string }): Promise<string> => {
    const resource = await services.mcp.readResource(args.uri, args.server);
    if (!resource) {
      return `MCP resource not found: ${args.uri}`;
    }

    return resource;
  },
};
