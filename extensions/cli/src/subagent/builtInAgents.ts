import { AgentConfig } from "./types.js";

// todo - move this to the subagent directory

/**
 * Built-in agent configurations
 */
export const BUILT_IN_AGENTS: Record<string, AgentConfig> = {
  general: {
    name: "general",
    displayName: "General Agent",
    description:
      "General-purpose agent for researching complex questions and executing multi-step tasks autonomously",
    tools: {
      // Enable all standard tools (refactor to use BUILTIN_TOOLS)
      Read: true,
      Write: true,
      Edit: true,
      multiEdit: true,
      listFiles: true,
      searchCode: true,
      runTerminalCommand: true,
      Fetch: true,
      writeChecklist: true,
      // Explicitly disable Task to prevent recursion
      Task: false,
    },
    // model: "haiku-4-5-latest", // if the model is not there, skip the task tool (check api key?)
    systemPrompt: `You are a specialized task execution agent.

Your role:
- Work autonomously to complete the given task
- Use available tools effectively
- Provide clear, concise results
- If you cannot complete the task, explain why clearly

Important:
- Focus on the specific task at hand
- Avoid unnecessary explanations or preamble in your final response
- Return actionable results`,
  },
};

/**
 * Get an agent by name
 */
export function getAgent(name: string): AgentConfig | null {
  return BUILT_IN_AGENTS[name] || null;
}

/**
 * List all available subagents
 */
export function listSubagents(): AgentConfig[] {
  return Object.values(BUILT_IN_AGENTS);
}

/**
 * Generate dynamic tool description listing available agents
 */
export function generateTaskToolDescription(): string {
  const agents = listSubagents();
  const agentList = agents
    .map((agent) => `  - ${agent.name}: ${agent.description}`)
    .join("\n");

  return `Launch a specialized agent to handle complex, multi-step tasks autonomously.

Available agent types:
${agentList}

When to use this tool:
- Complex research tasks requiring multiple file reads and searches
- Multi-step implementation tasks
- Tasks that benefit from autonomous execution
- When you need to parallelize independent work

When NOT to use this tool:
- Simple single-file reads (use Read tool instead)
- Single searches (use searchCode tool instead)
- Tasks you can complete directly with available tools
- Trivial operations that don't require multiple steps`;
}
