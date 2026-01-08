import { ModelService } from "../services/ModelService.js";
import type { ModelServiceState } from "../services/types.js";

/**
 * Get an agent by name
 */
export function getSubagent(modelState: ModelServiceState, name: string) {
  return (
    ModelService.getSubagentModels(modelState).find(
      (model) => model.model.name === name,
    ) ?? null
  );
}

/**
 * Generate dynamic tool description listing available agents
 */
export function generateSubagentToolDescription(
  modelState: ModelServiceState,
): string {
  const agentList = ModelService.getSubagentModels(modelState)
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

export function getAgentNames(modelState: ModelServiceState): string[] {
  return ModelService.getSubagentModels(modelState).map(
    (model) => model.model.name,
  );
}
