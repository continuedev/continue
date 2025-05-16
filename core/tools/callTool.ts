import { ContextItem, Tool, ToolExtras } from "..";
import { MCPManagerSingleton } from "../context/mcp/MCPManagerSingleton";
import { canParseUrl } from "../util/url";
import { BuiltInToolNames } from "./builtIn";

import { createNewFileImpl } from "./implementations/createNewFile";
import { createRuleBlockImpl } from "./implementations/createRuleBlock";
import { fileGlobSearchImpl } from "./implementations/globSearch";
import { grepSearchImpl } from "./implementations/grepSearch";
import { lsToolImpl } from "./implementations/lsTool";
import { readCurrentlyOpenFileImpl } from "./implementations/readCurrentlyOpenFile";
import { readFileImpl } from "./implementations/readFile";
import { runTerminalCommandImpl } from "./implementations/runTerminalCommand";
import { searchWebImpl } from "./implementations/searchWeb";
import { viewDiffImpl } from "./implementations/viewDiff";

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

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to call tool at ${url}:\n${JSON.stringify(data)}`);
  }

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
        throw new Error(JSON.stringify(response.content));
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

async function callBuiltInTool(
  functionName: string,
  args: any,
  extras: ToolExtras,
): Promise<ContextItem[]> {
  switch (functionName) {
    case BuiltInToolNames.ReadFile:
      return await readFileImpl(args, extras);
    case BuiltInToolNames.CreateNewFile:
      return await createNewFileImpl(args, extras);
    case BuiltInToolNames.GrepSearch:
      return await grepSearchImpl(args, extras);
    case BuiltInToolNames.FileGlobSearch:
      return await fileGlobSearchImpl(args, extras);
    case BuiltInToolNames.RunTerminalCommand:
      return await runTerminalCommandImpl(args, extras);
    case BuiltInToolNames.SearchWeb:
      return await searchWebImpl(args, extras);
    case BuiltInToolNames.ViewDiff:
      return await viewDiffImpl(args, extras);
    case BuiltInToolNames.LSTool:
      return await lsToolImpl(args, extras);
    case BuiltInToolNames.ReadCurrentlyOpenFile:
      return await readCurrentlyOpenFileImpl(args, extras);
    case BuiltInToolNames.CreateRuleBlock:
      return await createRuleBlockImpl(args, extras);
    default:
      throw new Error(`Tool "${functionName}" not found`);
  }
}

// Handles calls for core/non-client tools
// Returns an error context item if the tool call fails
// Note: Edit tool is handled on client
export async function callTool(
  tool: Tool,
  callArgs: string,
  extras: ToolExtras,
): Promise<{
  contextItems: ContextItem[];
  errorMessage: string | undefined;
}> {
  try {
    const args = JSON.parse(callArgs || "{}");
    const contextItems = tool.uri
      ? await callToolFromUri(tool.uri, args, extras)
      : await callBuiltInTool(tool.function.name, args, extras);
    if (tool.faviconUrl) {
      contextItems.forEach((item) => {
        item.icon = tool.faviconUrl;
      });
    }
    return {
      contextItems,
      errorMessage: undefined,
    };
  } catch (e) {
    let errorMessage = `${e}`;
    if (e instanceof Error) {
      errorMessage = e.message;
    }
    return {
      contextItems: [],
      errorMessage,
    };
  }
}
