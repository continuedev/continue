import { createLlmApi } from "../config.js";
import { ModelService } from "../services/ModelService.js";
import type { ModelServiceState } from "../services/types.js";

import {
  BUILT_IN_SUBAGENTS,
  createBuiltInSubagentModel,
  isLocalAnthropicModel,
} from "./builtInSubagents.js";

function getAllSubagentModels(modelState: ModelServiceState) {
  const configSubagents = ModelService.getSubagentModels(modelState);

  if (!isLocalAnthropicModel(modelState.model)) {
    return configSubagents;
  }

  const builtInSubagents = BUILT_IN_SUBAGENTS.map((subagent) => {
    const subagentModel = createBuiltInSubagentModel(
      subagent,
      modelState.model!,
    );
    return {
      llmApi: createLlmApi(subagentModel, modelState.authConfig),
      model: subagentModel,
      assistant: modelState.assistant,
      authConfig: modelState.authConfig,
    };
  });

  return [...configSubagents, ...builtInSubagents];
}

export function getSubagent(modelState: ModelServiceState, name: string) {
  return (
    getAllSubagentModels(modelState).find(
      (model) => model.model.name === name,
    ) ?? null
  );
}

export function generateSubagentToolDescription(
  modelState: ModelServiceState,
): string {
  const agentList = getAllSubagentModels(modelState)
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
  return getAllSubagentModels(modelState).map((model) => model.model.name);
}
