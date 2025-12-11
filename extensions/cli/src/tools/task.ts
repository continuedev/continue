import { services } from "../services/index.js";
import {
  generateTaskToolDescription,
  getAgent,
} from "../subagent/builtInAgents.js";
import { executeSubAgent } from "../subagent/executor.js";
import { logger } from "../util/logger.js";

import { Tool } from "./types.js";

export const taskTool: Tool = {
  name: "Task",
  displayName: "Task",
  description: generateTaskToolDescription(),
  readonly: false,
  isBuiltIn: true,

  parameters: {
    type: "object",
    required: ["description", "prompt", "subagent_type"],
    properties: {
      description: {
        type: "string",
        description: "A short (3-5 words) description of the task",
      },
      prompt: {
        type: "string",
        description: "The task for the agent to perform",
      },
      // todo: change this to subagent name
      subagent_type: {
        type: "string",
        description:
          "The type of specialized agent to use for this task (e.g., 'general')",
      },
    },
  },

  preprocess: async (args) => {
    const { description, subagent_type } = args;

    const agent = getAgent(subagent_type);
    if (!agent) {
      throw new Error(
        `Unknown agent type: ${subagent_type}. Available agents: general`,
      );
    }

    return {
      args,
      preview: [
        {
          type: "text",
          content: `Spawning ${agent.displayName} to: ${description}`,
        },
      ],
    };
  },

  run: async (args, context?: { toolCallId: string }) => {
    const { description, prompt, subagent_type } = args;

    logger.debug("debug1", { args, context });

    // Get agent configuration
    const agent = getAgent(subagent_type);
    if (!agent) {
      throw new Error(`Unknown agent type: ${subagent_type}`);
    }

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
      description,
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
