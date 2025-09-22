import { MCPServerStatus, MCPTool } from "..";
export function getMCPToolName(server: MCPServerStatus, tool: MCPTool) {
  // Replace any sequence of non-alphanumeric characters with a single underscore
  const serverPrefix = server.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") // Remove leading/trailing underscores
    .replace(/_+/g, "_"); // Replace multiple sequential underscores with single underscore

  if (tool.name.startsWith(serverPrefix)) {
    return tool.name;
  }
  return `${serverPrefix}_${tool.name}`;
}
