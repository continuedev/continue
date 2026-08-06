import { ModelDescription, Tool } from "core";
import {
  DEFAULT_AGENT_SYSTEM_MESSAGE,
  DEFAULT_CHAT_SYSTEM_MESSAGE,
  DEFAULT_PLAN_SYSTEM_MESSAGE,
} from "core/llm/defaultSystemMessages";
import {
  getBaseSystemMessage,
  getWorkspaceDisplayPath,
  NO_TOOL_WARNING,
} from "./getBaseSystemMessage";

test("getBaseSystemMessage should return the correct system message based on mode", () => {
  const mockModel = {
    baseChatSystemMessage: "Custom Chat System Message",
    basePlanSystemMessage: "Custom Plan System Message",
    baseAgentSystemMessage: "Custom Agent System Message",
  } as ModelDescription;

  const mockTool = {
    function: {
      name: "testTool",
      description: "Test tool",
      parameters: {},
    },
  } as Tool;

  // Test agent mode with custom message and tools
  expect(getBaseSystemMessage("agent", mockModel, [mockTool])).toBe(
    "Custom Agent System Message",
  );

  // Test plan mode with custom message and tools
  expect(getBaseSystemMessage("plan", mockModel, [mockTool])).toBe(
    "Custom Plan System Message",
  );

  // Test chat mode with custom message and tools
  expect(getBaseSystemMessage("chat", mockModel, [mockTool])).toBe(
    "Custom Chat System Message",
  );

  // Test agent mode with default message and tools
  expect(
    getBaseSystemMessage("agent", {} as ModelDescription, [mockTool]),
  ).toBe(DEFAULT_AGENT_SYSTEM_MESSAGE);

  // Test plan mode with default message and tools
  expect(getBaseSystemMessage("plan", {} as ModelDescription, [mockTool])).toBe(
    DEFAULT_PLAN_SYSTEM_MESSAGE,
  );

  // Test chat mode with default message and tools
  expect(getBaseSystemMessage("chat", {} as ModelDescription, [mockTool])).toBe(
    DEFAULT_CHAT_SYSTEM_MESSAGE,
  );
});

test("getBaseSystemMessage should append no-tools warning for agent/plan modes without tools", () => {
  const mockModel = {
    baseChatSystemMessage: "Custom Chat System Message",
    basePlanSystemMessage: "Custom Plan System Message",
    baseAgentSystemMessage: "Custom Agent System Message",
  } as ModelDescription;

  // Test agent mode without tools
  expect(getBaseSystemMessage("agent", mockModel, [])).toBe(
    "Custom Agent System Message" + NO_TOOL_WARNING,
  );

  // Test plan mode without tools
  expect(getBaseSystemMessage("plan", mockModel, [])).toBe(
    "Custom Plan System Message" + NO_TOOL_WARNING,
  );

  // Test chat mode without tools (should not append warning)
  expect(getBaseSystemMessage("chat", mockModel, [])).toBe(
    "Custom Chat System Message",
  );

  // Test agent mode with undefined tools
  expect(getBaseSystemMessage("agent", mockModel)).toBe(
    "Custom Agent System Message" + NO_TOOL_WARNING,
  );

  // Test plan mode with undefined tools
  expect(getBaseSystemMessage("plan", mockModel)).toBe(
    "Custom Plan System Message" + NO_TOOL_WARNING,
  );
});

test("getBaseSystemMessage should inject the workspace root for agent and plan modes", () => {
  const mockModel = {
    baseChatSystemMessage: "Custom Chat System Message",
    basePlanSystemMessage: "Custom Plan System Message",
    baseAgentSystemMessage: "Custom Agent System Message",
  } as ModelDescription;

  const mockTool = {
    function: {
      name: "testTool",
      description: "Test tool",
      parameters: {},
    },
  } as Tool;

  const workspaceDirectory = "vscode-remote://ssh-remote+debian/opt/billing";

  // Agent mode: workspace root appended after the base message
  const agentMessage = getBaseSystemMessage(
    "agent",
    mockModel,
    [mockTool],
    workspaceDirectory,
  );
  expect(agentMessage).toContain("Custom Agent System Message");
  expect(agentMessage).toContain("Your workspace root is: /opt/billing");

  // Plan mode: workspace root appended after the base message
  const planMessage = getBaseSystemMessage(
    "plan",
    mockModel,
    [mockTool],
    workspaceDirectory,
  );
  expect(planMessage).toContain("Custom Plan System Message");
  expect(planMessage).toContain("Your workspace root is: /opt/billing");

  // Chat mode: workspace root is not injected
  const chatMessage = getBaseSystemMessage(
    "chat",
    mockModel,
    [mockTool],
    workspaceDirectory,
  );
  expect(chatMessage).toBe("Custom Chat System Message");

  // No workspace: no injection
  expect(getBaseSystemMessage("agent", mockModel, [mockTool], "")).toBe(
    "Custom Agent System Message",
  );
  expect(getBaseSystemMessage("agent", mockModel, [mockTool], undefined)).toBe(
    "Custom Agent System Message",
  );

  // No tools: no injection (avoids contradicting NO_TOOL_WARNING)
  expect(getBaseSystemMessage("agent", mockModel, [], workspaceDirectory)).toBe(
    "Custom Agent System Message" + NO_TOOL_WARNING,
  );
});

test("getWorkspaceDisplayPath should convert workspace URIs to display paths", () => {
  // Remote-SSH (the reported bug: model invented C:\workspace)
  expect(
    getWorkspaceDisplayPath("vscode-remote://ssh-remote+debian/opt/billing"),
  ).toBe("/opt/billing");

  // Dev Containers
  expect(
    getWorkspaceDisplayPath("vscode-remote://dev-container+abc123/workspace"),
  ).toBe("/workspace");

  // vscode-vfs
  expect(getWorkspaceDisplayPath("vscode-vfs://github/continue/continue")).toBe(
    "/continue/continue",
  );

  // Local POSIX
  expect(getWorkspaceDisplayPath("file:///home/user/proj")).toBe(
    "/home/user/proj",
  );

  // Local Windows
  expect(getWorkspaceDisplayPath("file:///C:/Users/bob/my%20project")).toBe(
    "C:/Users/bob/my project",
  );

  // Unsupported / missing
  expect(getWorkspaceDisplayPath("untitled:Untitled-1")).toBeNull();
  expect(getWorkspaceDisplayPath("")).toBeNull();
  expect(getWorkspaceDisplayPath("not a uri")).toBeNull();
});
