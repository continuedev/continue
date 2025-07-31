import { expect, test } from "vitest";
import { MCPServerStatus, MCPTool } from "..";
import { getMCPToolName } from "./mcpToolName";

const createMcpServer = (name: string): MCPServerStatus => ({
  name,
  errors: [],
  prompts: [],
  tools: [],
  resources: [],
  resourceTemplates: [],
  status: "connected",
  id: "",
  transport: {
    type: "sse",
    url: "",
  },
  isProtectedResource: false,
});

const createMCPTool = (name: string): MCPTool => ({
  name,
  inputSchema: {
    type: "object",
  },
});

test("getMCPToolName - adds server prefix to tool name when not present", () => {
  const server = createMcpServer("Github");
  const tool = createMCPTool("create_pull_request");

  const result = getMCPToolName(server, tool);
  expect(result).toBe("github_create_pull_request");
});

test("getMCPToolName - preserves tool name when it already starts with server prefix", () => {
  const server = createMcpServer("Github");
  const tool = createMCPTool("github_create_pull_request");

  const result = getMCPToolName(server, tool);
  expect(result).toBe("github_create_pull_request");
});

test("getMCPToolName - handles server names with spaces", () => {
  const server = createMcpServer("Azure DevOps");
  const tool = createMCPTool("create_pipeline");

  const result = getMCPToolName(server, tool);
  expect(result).toBe("azure_devops_create_pipeline");
});

test("getMCPToolName - handles mixed case in server names", () => {
  const server = createMcpServer("GitLab");
  const tool = createMCPTool("create_merge_request");

  const result = getMCPToolName(server, tool);
  expect(result).toBe("gitlab_create_merge_request");
});
