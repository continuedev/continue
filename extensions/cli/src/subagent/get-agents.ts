import { services } from "../services/index.js";

/**
 * Get an agent by name
 */
export function getSubagent(name: string) {
  return (
    services.model
      .getSubagentModels()
      .find((model) => model.model.name === name) ?? null
  );
}

/**
 * Generate dynamic tool description listing available agents
 */
export function generateSubagentToolDescription(): string {
  const agentList = services.model
    .getSubagentModels()
    .map(
      (subagentModel) =>
        `  - ${subagentModel.model.name}: ${subagentModel.model.chatOptions?.baseSystemMessage}`,
    )
    .join("\n");

  // todo: refine this prompt later
  return `Launch a specialized subagent to handle a specific task.

Here are the available subagents:
${agentList}
`;
}

export function getAgentNames(): string[] {
  return services.model.getSubagentModels().map((model) => model.model.name);
}
