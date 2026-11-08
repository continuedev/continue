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
import {
  formatSubagentResult,
  linkedAbortController,
} from "../subagent/result.js";
import { logger } from "../util/logger.js";

import { Tool, ToolRunContext } from "./types.js";

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

    run: async (args: any, context?: ToolRunContext) => {
      const { prompt, subagent_name } = args;

      logger.debug("subagent args", { args, context });

      // get agent configuration
      const agent = getSubagent(modelServiceState, subagent_name);
      if (!agent) {
        throw new Error(`Unknown agent type: ${subagent_name}`);
      }

      const chatHistoryService = services.chatHistory;
      // A headless run has no session of its own, and needs none
      const parentSessionId = chatHistoryService.getSessionId();

      // Cancelling the parent turn (Esc, a serve interrupt, a headless
      // signal) cancels the subagent.
      const { controller, dispose } = linkedAbortController(
        context?.abortSignal,
      );

      try {
        // Execute subagent with output streaming
        const result = await executeSubAgent({
          agent,
          agentName: subagent_name,
          prompt,
          parentSessionId,
          abortController: controller,
          onToolPermissionRequest: context?.onToolPermissionRequest,
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

        return formatSubagentResult(subagent_name, result);
      } finally {
        dispose();
      }
    },
  };
};
