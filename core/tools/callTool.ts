import { ContextItem, Tool, ToolExtras } from "..";
import { MCPManagerSingleton } from "../context/mcp";
import { canParseUrl } from "../util/url";
import { BuiltInToolNames } from "./builtIn";

import { createNewFileImpl } from "./implementations/createNewFile";
import { fileGlobSearchImpl } from "./implementations/globSearch";
import { grepSearchImpl } from "./implementations/grepSearch";
import { lsToolImpl } from "./implementations/lsTool";
import { readCurrentlyOpenFileImpl } from "./implementations/readCurrentlyOpenFile";
import { readFileImpl } from "./implementations/readFile";
import { runTerminalCommandImpl } from "./implementations/runTerminalCommand";
import { searchWebImpl } from "./implementations/searchWeb";
import { viewDiffImpl } from "./implementations/viewDiff";
import { toolErrorContextItem } from "./toolError";

async function callHttpTool(
  url: string,
  args: any,
  extras: ToolExtras,
): Promise<ContextItem[]> {
  const response = await extras.fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      arguments: args,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to call tool: ${url}`);
  }

  const data = await response.json();
  return data.output;
}

export function encodeMCPToolUri(mcpId: string, toolName: string): string {
  return `mcp://${encodeURIComponent(mcpId)}/${encodeURIComponent(toolName)}`;
}

export function decodeMCPToolUri(uri: string): [string, string] | null {
  const url = new URL(uri);
  if (url.protocol !== "mcp:") {
    return null;
  }
  return [
    decodeURIComponent(url.hostname),
    decodeURIComponent(url.pathname).slice(1), // to remove leading '/'
  ];
}

async function callToolFromUri(
  uri: string,
  args: any,
  extras: ToolExtras,
): Promise<ContextItem[]> {
  const parseable = canParseUrl(uri);
  if (!parseable) {
    throw new Error(`Invalid URI: ${uri}`);
  }
  const parsedUri = new URL(uri);

  switch (parsedUri?.protocol) {
    case "http:":
    case "https:":
      return callHttpTool(uri, args, extras);
    case "mcp:":
      const decoded = decodeMCPToolUri(uri);
      if (!decoded) {
        throw new Error(`Invalid MCP tool URI: ${uri}`);
      }
      const [mcpId, toolName] = decoded;
      const client = MCPManagerSingleton.getInstance().getConnection(mcpId);

      if (!client) {
        throw new Error("MCP connection not found");
      }
      const response = await client.client.callTool({
        name: toolName,
        arguments: args,
      });

      if (response.isError === true) {
        throw new Error(`Failed to call tool: ${toolName}`);
      }

      const contextItems: ContextItem[] = [];
      (response.content as any).forEach((item: any) => {
        if (item.type === "text") {
          contextItems.push({
            name: extras.tool.displayTitle,
            description: "Tool output",
            content: item.text,
            icon: extras.tool.faviconUrl,
          });
        } else if (item.type === "resource") {
          // TODO resource change subscribers https://modelcontextprotocol.io/docs/concepts/resources
          if (item.resource?.blob) {
            contextItems.push({
              name: extras.tool.displayTitle,
              description: "MCP Item Error",
              content:
                "Error: tool call received unsupported blob resource item",
              icon: extras.tool.faviconUrl,
            });
          }
          // TODO account for mimetype? // const mimeType = item.resource.mimeType
          // const uri = item.resource.uri;
          contextItems.push({
            name: extras.tool.displayTitle,
            description: "Tool output",
            content: item.resource.text,
            icon: extras.tool.faviconUrl,
          });
        } else {
          contextItems.push({
            name: extras.tool.displayTitle,
            description: "MCP Item Error",
            content: `Error: tool call received unsupported item of type "${item.type}"`,
            icon: extras.tool.faviconUrl,
          });
        }
      });
      return contextItems;
    default:
      throw new Error(`Unsupported protocol: ${parsedUri?.protocol}`);
  }
}

// Handles calls for core/non-client tools
// Returns an error context item if the tool call fails
export async function callTool(
  tool: Tool,
  callArgs: string,
  extras: ToolExtras,
): Promise<ContextItem[]> {
  const args = JSON.parse(callArgs || "{}");
  const uri = tool.uri ?? tool.function.name;
  try {
    let contextItems: ContextItem[] = [];
    switch (uri) {
      case BuiltInToolNames.ReadFile:
        contextItems = await readFileImpl(args, extras);
      case BuiltInToolNames.CreateNewFile:
        contextItems = await createNewFileImpl(args, extras);
      case BuiltInToolNames.GrepSearch:
        contextItems = await grepSearchImpl(args, extras);
      case BuiltInToolNames.FileGlobSearch:
        contextItems = await fileGlobSearchImpl(args, extras);
      case BuiltInToolNames.RunTerminalCommand:
        contextItems = await runTerminalCommandImpl(args, extras);
      case BuiltInToolNames.SearchWeb:
        contextItems = await searchWebImpl(args, extras);
      case BuiltInToolNames.ViewDiff:
        contextItems = await viewDiffImpl(args, extras);
      case BuiltInToolNames.LSTool:
        contextItems = await lsToolImpl(args, extras);
      case BuiltInToolNames.ReadCurrentlyOpenFile:
        contextItems = await readCurrentlyOpenFileImpl(args, extras);
      // case BuiltInToolNames.ViewRepoMap:
      //   contextItems = await viewRepoMapImpl(args, extras);
      // case BuiltInToolNames.ViewSubdirectory:
      //   contextItems = await viewSubdirectoryImpl(args, extras);
      default:
        contextItems = await callToolFromUri(uri, args, extras);
    }
    if (tool.faviconUrl) {
      contextItems.forEach((item) => {
        item.icon = tool.faviconUrl;
      });
    }
    return contextItems;
  } catch (e) {
    let errorMessage = `${e}`;
    if (e instanceof Error) {
      errorMessage = e.message;
    }
    return [toolErrorContextItem(uri, errorMessage)];
  }
}
