import { MCPServerStatus, MCPTool } from "..";
export function getMCPToolName(server: MCPServerStatus, tool: MCPTool) {
  return getToolNameFromMCPServer(server.name, tool.name);
}

export function getToolNameFromMCPServer(serverName: string, toolName: string) {
  // Replace any sequence of non-alphanumeric characters with a single underscore
  const serverPrefix = serverName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") // Remove leading/trailing underscores
    .replace(/_+/g, "_"); // Replace multiple sequential underscores with single underscore

  if (toolName.startsWith(serverPrefix)) {
    return toolName;
  }
  return `${serverPrefix}_${toolName}`;
}
