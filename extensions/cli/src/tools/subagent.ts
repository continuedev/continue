import { services } from "../services/index.js";
import {
  generateSubagentToolDescription,
  getSubagent,
  getAgentNames as getSubagentNames,
} from "../subagent/get-agents.js";
import { logger } from "../util/logger.js";

import { GetTool } from "./types.js";

export const subagentTool: GetTool = (params) => ({
  name: "Subagent",
  displayName: "Subagent",
  description: params
    ? generateSubagentToolDescription(params.modelServiceState)
    : "Use a subagent to handle a specialized task.",
  readonly: false,
  isBuiltIn: true,

  parameters: {
    type: "object",
    required: ["description", "prompt", "subagent_name"],
    properties: {
      description: {
        type: "string",
        description: "A short (3-5 words) description of the task",
      },
      prompt: {
        type: "string",
        description: "The task for the agent to perform",
      },
      subagent_name: {
        type: "string",
        description: `The type of specialized agent to use for this task. Available agents: ${
          params ? getSubagentNames(params.modelServiceState).join(", ") : ""
        }`,
      },
    },
  },

  preprocess: async (args: any) => {
    if (!params) {
      return {
        args,
        preview: [
          {
            type: "text",
            content: "Subagent not found",
          },
        ],
      };
    }

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
    if (!params) return "";

    const { prompt, subagent_name } = args;

    logger.debug("subagent args", { args, context });

    // get agent configuration
    const agent = getSubagent(params.modelServiceState, subagent_name);
    if (!agent) {
      throw new Error(`Unknown agent type: ${subagent_name}`);
    }

    const parentSessionId = services.chatHistory.getSessionId();
    if (!parentSessionId) {
      throw new Error("No active session found");
    }

    // Create abort controller for child execution
    const abortController = new AbortController();

    const { executeSubAgent } = await import("../subagent/executor.js"); // prevent cyclical import

    // Execute subagent with output streaming
    const result = await executeSubAgent({
      agent,
      prompt,
      parentSessionId,
      abortController,
      onOutputUpdate: context?.toolCallId
        ? (output: string) => {
            try {
              services.chatHistory.addToolResult(
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
