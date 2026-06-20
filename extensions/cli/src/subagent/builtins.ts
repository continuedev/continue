import { ModelConfig, ModelRole } from "@continuedev/config-yaml";

import { createLlmApi } from "../config.js";
import type { ModelServiceState } from "../services/types.js";

interface BuiltInSubagentDefinition {
  name: string;
  baseSystemMessage: string;
}

const BUILT_IN_SUBAGENT_DEFINITIONS: BuiltInSubagentDefinition[] = [
  {
    name: "planner",
    baseSystemMessage:
      "Planner. Investigate the task, identify the most relevant files, constraints, and validation steps, then return a concise execution plan. Do not make unrelated edits.",
  },
  {
    name: "researcher",
    baseSystemMessage:
      "Researcher. Gather the most relevant code, configuration, and documentation context for the task. Summarize concrete findings, tradeoffs, and unknowns with evidence from the repo.",
  },
  {
    name: "reviewer",
    baseSystemMessage:
      "Reviewer. Review the proposed implementation for correctness, regressions, missing tests, and edge cases. Prioritize actionable findings and be specific.",
  },
];

function createBuiltInSubagentModel(
  baseModel: ModelConfig,
  definition: BuiltInSubagentDefinition,
): ModelConfig {
  return {
    ...baseModel,
    name: definition.name,
    roles: [...new Set<ModelRole>([...(baseModel.roles ?? []), "subagent"])],
    chatOptions: {
      ...baseModel.chatOptions,
      baseSystemMessage: definition.baseSystemMessage,
    },
  };
}

export function getBuiltInSubagentModels(
  modelState: ModelServiceState,
): ModelServiceState[] {
  const baseModel = modelState.model;
  if (!baseModel) {
    return [];
  }

  return BUILT_IN_SUBAGENT_DEFINITIONS.map((definition) => {
    const model = createBuiltInSubagentModel(baseModel, definition);
    return {
      llmApi: createLlmApi(model, modelState.authConfig),
      model,
      assistant: modelState.assistant,
      authConfig: modelState.authConfig,
    };
  }).filter((subagentModel) => !!subagentModel.llmApi);
}
