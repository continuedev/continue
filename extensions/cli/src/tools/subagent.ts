import {
  generateSubagentToolDescription,
  getAgent,
} from "../subagent/builtInAgents.js";
import { executeSubAgent } from "../subagent/executor.js";
import { logger } from "../util/logger.js";

import { Tool } from "./types.js";

export const subagentTool: Tool = {
  name: "Subagent",
  displayName: "Subagent",
  description: generateSubagentToolDescription(),
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
        description:
          "The type of specialized agent to use for this task (e.g., 'general')",
      },
    },
  },

  preprocess: async (args) => {
    const { description, subagent_name } = args;

    const agent = getAgent(subagent_name);
    if (!agent) {
      throw new Error(
        `Unknown agent type: ${subagent_name}. Available agents: general`,
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

  run: async (args, context?: { toolCallId: string }) => {
    const { prompt, subagent_name } = args;

    logger.debug("debug1 subagent args", { args, context });

    // Get agent configuration
    const agent = getAgent(subagent_name);
    if (!agent) {
      throw new Error(`Unknown agent type: ${subagent_name}`);
    }

    // Lazy import services to avoid circular dependency
    const { services } = await import("../services/index.js");

    // Get parent session ID from chat history service
    const chatHistoryService = services.chatHistory;
    const parentSessionId = chatHistoryService.getSessionId();

    if (!parentSessionId) {
      throw new Error("No active session found");
    }

    // Create abort controller for child execution
    const abortController = new AbortController();

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

    logger.debug("debug1 subagent result->", { result });

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
};
