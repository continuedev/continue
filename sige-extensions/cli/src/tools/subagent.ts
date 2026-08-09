import { services } from "../services/index.js";
import { serviceContainer } from "../services/ServiceContainer.js";
import { ModelServiceState, SERVICE_NAMES } from "../services/types.js";
import { executeSubAgent } from "../subagent/executor.js";
import {
  generateSubagentToolDescription,
  getSubagent,
  getAgentNames as getSubagentNames,
} from "../subagent/get-agents.js";
import { SUBAGENT_TOOL_META } from "../subagent/index.js";
import { logger } from "../util/logger.js";

import { Tool } from "./types.js";

export const subagentTool = async (): Promise<Tool> => {
  const modelServiceState = await serviceContainer.get<ModelServiceState>(
    SERVICE_NAMES.MODEL,
  );

  return {
    ...SUBAGENT_TOOL_META,

    description: generateSubagentToolDescription(modelServiceState),

    parameters: {
      ...SUBAGENT_TOOL_META.parameters,
      properties: {
        ...SUBAGENT_TOOL_META.parameters.properties,
        subagent_name: {
          type: "string",
          description: `The type of specialized agent to use for this task. Available agents: ${
            modelServiceState
              ? getSubagentNames(modelServiceState).join(", ")
              : ""
          }`,
        },
      },
    },

    preprocess: async (args: any) => {
      const { description, subagent_name } = args;

      const agent = getSubagent(modelServiceState, subagent_name);
      if (!agent) {
        throw new Error(
          `Unknown agent type: ${subagent_name}. Available agents: ${getSubagentNames(
            modelServiceState,
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
      const agent = getSubagent(modelServiceState, subagent_name);
      if (!agent) {
        throw new Error(`Unknown agent type: ${subagent_name}`);
      }

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
  };
};
