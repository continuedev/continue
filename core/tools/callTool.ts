import { ContextItem, Tool, ToolExtras } from "..";
import { MCPManagerSingleton } from "../context/mcp";
import { BuiltInToolNames } from "./builtIn";

import { createNewFileImpl } from "./implementations/createNewFile";
import { exactSearchImpl } from "./implementations/exactSearch";
import { readCurrentlyOpenFileImpl } from "./implementations/readCurrentlyOpenFile";
import { readFileImpl } from "./implementations/readFile";
import { runTerminalCommandImpl } from "./implementations/runTerminalCommand";
import { searchWebImpl } from "./implementations/searchWeb";
import { viewDiffImpl } from "./implementations/viewDiff";
import { viewRepoMapImpl } from "./implementations/viewRepoMap";
import { viewSubdirectoryImpl } from "./implementations/viewSubdirectory";

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
  // @ts-ignore
  const canParse = URL.canParse(uri);
  if (!canParse) {
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

      return (response.content as any).map((item: any): ContextItem => {
        if (item.type !== "text") {
          throw new Error(
            `Continue received item of type "${item.type}" from MCP tool, but currently only supports "text".`,
          );
        }
        return {
          name: extras.tool.displayTitle,
          description: "Tool output",
          content: item.text,
          icon: extras.tool.faviconUrl,
        };
      });

    default:
      throw new Error(`Unsupported protocol: ${parsedUri?.protocol}`);
  }
}

export async function callTool(
  tool: Tool,
  args: any,
  extras: ToolExtras,
): Promise<ContextItem[]> {
  const uri = tool.uri ?? tool.function.name;

  switch (uri) {
    case BuiltInToolNames.ReadFile:
      return await readFileImpl(args, extras);
    case BuiltInToolNames.CreateNewFile:
      return await createNewFileImpl(args, extras);
    case BuiltInToolNames.ExactSearch:
      return await exactSearchImpl(args, extras);
    case BuiltInToolNames.RunTerminalCommand:
      return await runTerminalCommandImpl(args, extras);
    case BuiltInToolNames.SearchWeb:
      return await searchWebImpl(args, extras);
    case BuiltInToolNames.ViewDiff:
      return await viewDiffImpl(args, extras);
    case BuiltInToolNames.ViewRepoMap:
      return await viewRepoMapImpl(args, extras);
    case BuiltInToolNames.ViewSubdirectory:
      return await viewSubdirectoryImpl(args, extras);
    case BuiltInToolNames.ReadCurrentlyOpenFile:
      return await readCurrentlyOpenFileImpl(args, extras);
    default:
      return await callToolFromUri(uri, args, extras);
  }
}
