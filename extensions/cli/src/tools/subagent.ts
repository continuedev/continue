import {
  generateSubagentToolDescription,
  getSubagent,
  getAgentNames as getSubagentNames,
} from "../subagent/get-agents.js";
import { logger } from "../util/logger.js";

import { GetTool, Tool } from "./types.js";

export const SUBAGENT_TOOL_META: Tool = {
  name: "Subagent",
  displayName: "Subagent",
  description: "Use a subagent to handle a specialized task.",
  readonly: false,
  isBuiltIn: true,
  parameters: {
    type: "object",
    required: ["description", "prompt", "subagent_name"],
    properties: {
      description: {
        type: "string",
        description: "A short description of the task",
      },
      prompt: {
        type: "string",
        description: "The task for the agent to perform",
      },
      subagent_name: {
        type: "string",
        description: "The type of specialized agent to use for this task.",
      },
    },
  },
  run: async () => "",
};

export const subagentTool: GetTool = (params) => ({
  ...SUBAGENT_TOOL_META,

  description: generateSubagentToolDescription(params.modelServiceState),

  parameters: {
    ...SUBAGENT_TOOL_META.parameters,
    properties: {
      ...SUBAGENT_TOOL_META.parameters.properties,
      subagent_name: {
        type: "string",
        description: `The type of specialized agent to use for this task. Available agents: ${
          params ? getSubagentNames(params.modelServiceState).join(", ") : ""
        }`,
      },
    },
  },

  preprocess: async (args: any) => {
    const { description, subagent_name } = args;

    const agent = getSubagent(params.modelServiceState, subagent_name);
    if (!agent) {
      throw new Error(
        `Unknown agent type: ${subagent_name}. Available agents: ${getSubagentNames(
          params.modelServiceState,
        ).join(", ")}`,
      );
    }

    return {
      args,
      preview: [
        {
          type: "text",
          content: `Spawning ${agent.model.name} to: ${description}`,
        },
      ],
    };
  },

  run: async (args: any, context?: { toolCallId: string }) => {
    const { prompt, subagent_name } = args;

    logger.debug("subagent args", { args, context });

    // get agent configuration
    const agent = getSubagent(params.modelServiceState, subagent_name);
    if (!agent) {
      throw new Error(`Unknown agent type: ${subagent_name}`);
    }

    // Dynamically import to avoid circular dependency and passing repeated params
    const { executeSubAgent } = await import("../subagent/executor.js");
    const { services } = await import("../services/index.js");

    const chatHistoryService = services.chatHistory;
    const parentSessionId = chatHistoryService.getSessionId();
    if (!parentSessionId) {
      throw new Error("No active session found");
    }

    // Execute subagent with output streaming
    const result = await executeSubAgent({
      agent,
      prompt,
      parentSessionId,
      abortController: new AbortController(),
      onOutputUpdate: context?.toolCallId
        ? (output: string) => {
            try {
              chatHistoryService.addToolResult(
                context.toolCallId,
                output,
                "calling",
              );
            } catch {
              // Ignore errors during streaming updates
            }
          }
        : undefined,
    });

    logger.debug("subagent result", { result });

    const output = [
      result.response,
      "<task_metadata>",
      `status: ${result.success ? "completed" : "failed"}`,
      "</task_metadata>",
    ]
      .filter(Boolean)
      .join("\n");

    return output;
  },
});
