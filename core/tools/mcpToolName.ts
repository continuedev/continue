import { MCPServerStatus, MCPTool } from "..";
export function getMCPToolName(server: MCPServerStatus, tool: MCPTool) {
  return getToolNameFromMCPServer(server.name, tool.name);
}

/** A server name as used in tool names: lowercase, runs of other characters become one `_`. */
export function mcpServerSlug(serverName: string): string {
  return serverName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") // Remove leading/trailing underscores
    .replace(/_+/g, "_"); // Replace multiple sequential underscores with single underscore
}

export function getToolNameFromMCPServer(serverName: string, toolName: string) {
  const serverPrefix = mcpServerSlug(serverName);

  if (toolName.startsWith(serverPrefix)) {
    return toolName;
  }
  return `${serverPrefix}_${toolName}`;
}
