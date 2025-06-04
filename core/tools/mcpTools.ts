import { MCPServerStatus, MCPTool } from "..";

export function getMCPToolName(server: MCPServerStatus, tool: MCPTool) {
  const serverSuffix = server.name.split(" ").join("_").toLowerCase();
  if (tool.name.endsWith(serverSuffix)) {
    return tool.name;
  }
  return `${tool.name}_${serverSuffix}`;
}
