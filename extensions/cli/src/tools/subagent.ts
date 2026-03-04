import { services } from "../services/index.js";
import { serviceContainer } from "../services/ServiceContainer.js";
import { subAgentService } from "../services/SubAgentService.js";
import { ModelServiceState, SERVICE_NAMES } from "../services/types.js";
import {
  generateSubagentToolDescription,
  getSubagent,
  getAgentNames as getSubagentNames,
} from "../subagent/getAgents.js";
import {
  SUBAGENT_PARALLEL_TOOL_META,
  SUBAGENT_TOOL_META,
} from "../subagent/index.js";
import { logger } from "../util/logger.js";

import { Tool } from "./types.js";

interface SubagentTask {
  description: string;
  prompt: string;
  subagent_name: string;
}

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

      const result = await subAgentService.executeSubAgent({
        agent,
        prompt,
        parentSessionId,
        abortController: new AbortController(),
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

export const subagentParallelTool = async (): Promise<Tool> => {
  const modelServiceState = await serviceContainer.get<ModelServiceState>(
    SERVICE_NAMES.MODEL,
  );

  const availableAgents = modelServiceState
    ? getSubagentNames(modelServiceState).join(", ")
    : "";

  return {
    ...SUBAGENT_PARALLEL_TOOL_META,

    description: `Invoke multiple subagents in parallel and wait for all to complete. Use this when you have multiple independent tasks that can be executed concurrently. Available agents: ${availableAgents}`,

    parameters: {
      ...SUBAGENT_PARALLEL_TOOL_META.parameters,
      properties: {
        tasks: {
          ...SUBAGENT_PARALLEL_TOOL_META.parameters.properties.tasks,
          items: {
            type: "object",
            required: ["description", "prompt", "subagent_name"],
            properties: {
              ...SUBAGENT_TOOL_META.parameters.properties,
              subagent_name: {
                type: "string",
                description: `The type of specialized agent to use. Available: ${availableAgents}`,
              },
            },
          },
        },
      },
    },

    preprocess: async (args: any) => {
      const { tasks } = args as { tasks: SubagentTask[] };

      if (!Array.isArray(tasks) || tasks.length === 0) {
        throw new Error("tasks must be a non-empty array");
      }

      const previews: { type: string; content: string }[] = [];

      for (const task of tasks) {
        const agent = getSubagent(modelServiceState, task.subagent_name);
        if (!agent) {
          throw new Error(
            `Unknown agent type: ${task.subagent_name}. Available agents: ${availableAgents}`,
          );
        }
        previews.push({
          type: "text",
          content: `Spawning ${agent.model.name} to: ${task.description}`,
        });
      }

      return {
        args,
        preview: [
          {
            type: "text",
            content: `Spawning ${tasks.length} subagents in parallel:\n${previews.map((p) => `  - ${p.content}`).join("\n")}`,
          },
        ],
      };
    },

    run: async (args: any, context?: { toolCallId: string }) => {
      const { tasks } = args as { tasks: SubagentTask[] };

      logger.debug("subagent_parallel args", { args, context });

      const chatHistoryService = services.chatHistory;
      const parentSessionId = chatHistoryService.getSessionId();
      if (!parentSessionId) {
        throw new Error("No active session found");
      }

      const executeTask = async (task: SubagentTask, index: number) => {
        const agent = getSubagent(modelServiceState, task.subagent_name);
        if (!agent) {
          return {
            index,
            description: task.description,
            success: false,
            response: `Unknown agent type: ${task.subagent_name}`,
          };
        }

        try {
          const result = await subAgentService.executeSubAgent({
            agent,
            prompt: task.prompt,
            parentSessionId,
            abortController: new AbortController(),
          });

          return {
            index,
            description: task.description,
            success: result.success,
            response: result.response,
          };
        } catch (error) {
          return {
            index,
            description: task.description,
            success: false,
            response: `Error: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      };

      const results = await Promise.all(
        tasks.map((task, index) => executeTask(task, index)),
      );

      logger.debug("subagent_parallel results", { results });

      const outputParts = results.map((result) => {
        return [
          `<task index="${result.index}" description="${result.description}">`,
          result.response,
          `<task_metadata>`,
          `status: ${result.success ? "completed" : "failed"}`,
          `</task_metadata>`,
          `</task>`,
        ].join("\n");
      });

      return outputParts.join("\n\n");
    },
  };
};
