// Synthetic stdio MCP server for MCPConnection integration tests.
// Advertises resources and tools; resources/templates/list is only served
// when requested, mirroring low-level SDK servers that never register it.
//
// Usage: node stdioResourceServer.mjs [--templates=<mode>] [--tools=<mode>] [--crash-once=<marker file>]
//   templates: none (default, no handler -> -32601) | valid | internal-error | malformed | hang
//   tools:     valid (default) | internal-error
import fs from "node:fs";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const flags = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=");
    return [key, value ?? ""];
  }),
);
const templatesMode = flags.templates ?? "none";
const toolsMode = flags.tools ?? "valid";

// Fail the first launch only, to exercise reconnecting after a failure
if (flags["crash-once"] && !fs.existsSync(flags["crash-once"])) {
  fs.writeFileSync(flags["crash-once"], "crashed");
  process.exit(1);
}

const server = new Server(
  { name: "synthetic-resource-server", version: "1.0.0" },
  { capabilities: { resources: {}, tools: {} } },
);

const resources = [
  { uri: "synthetic://alpha", name: "Alpha", mimeType: "text/plain" },
  { uri: "synthetic://beta", name: "Beta", mimeType: "text/plain" },
];

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources,
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => ({
  contents: [
    { uri: request.params.uri, mimeType: "text/plain", text: "synthetic" },
  ],
}));

if (templatesMode !== "none") {
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    switch (templatesMode) {
      case "valid":
        return {
          resourceTemplates: [
            { uriTemplate: "synthetic://item/{id}", name: "Item" },
          ],
        };
      case "internal-error":
        throw new McpError(ErrorCode.InternalError, "synthetic failure");
      case "malformed":
        return { resourceTemplates: "not-an-array" };
      case "hang":
        return new Promise(() => {});
      default:
        throw new Error(`unknown templates mode: ${templatesMode}`);
    }
  });
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  if (toolsMode === "internal-error") {
    throw new McpError(ErrorCode.InternalError, "synthetic tools failure");
  }
  return {
    tools: [
      {
        name: "echo_types",
        description: "Returns the JSON type of each argument",
        inputSchema: {
          type: "object",
          properties: { text: { type: "string" }, count: { type: "integer" } },
        },
      },
      {
        name: "stats",
        description: "Returns fixed synthetic statistics",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const args = request.params.arguments ?? {};
  const text =
    request.params.name === "stats"
      ? "items: 2"
      : JSON.stringify(
          Object.fromEntries(
            Object.entries(args).map(([key, value]) => [key, typeof value]),
          ),
        );
  return { content: [{ type: "text", text }] };
});

await server.connect(new StdioServerTransport());
