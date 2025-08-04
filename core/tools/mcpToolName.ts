import { MCPServerStatus, MCPTool } from "..";

export function getMCPToolName(server: MCPServerStatus, tool: MCPTool) {
  const serverPrefix = server.name.split(" ").join("_").toLowerCase();
  if (tool.name.startsWith(serverPrefix)) {
    return tool.name;
  }
  return `${serverPrefix}_${tool.name}`;
}
