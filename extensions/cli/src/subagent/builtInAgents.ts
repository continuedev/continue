import { services } from "../services/index.js";
import { logger } from "../util/logger.js";

/**
 * Get an agent by name
 */
export function getAgent(name: string) {
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

  const temp = `Launch a specialized subagent to handle complex, multi-step tasks autonomously.

Available agent types:
${agentList}

When to use this tool:
- Complex research tasks requiring multiple file reads and searches
- Multi-step implementation tasks
- Tasks that benefit from autonomous execution
- When you need to parallelize independent work

When NOT to use this tool:
- Tasks you can complete directly with available tools
- Trivial operations that don't require multiple steps`;

  logger.debug("debug1 temp->", { temp });

  return temp;
}
