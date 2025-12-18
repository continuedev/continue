import type { ChatHistoryItem } from "core";

import { SERVICE_NAMES, serviceContainer } from "../services/index.js";
import { ToolPermissionServiceState } from "../services/ToolPermissionService.js";
import { streamChatResponse } from "../stream/streamChatResponse.js";
import { logger } from "../util/logger.js";

import { AgentConfig } from "./types.js";

/**
 * Options for executing a subagent
 */
export interface SubAgentExecutionOptions {
  agent: AgentConfig;
  prompt: string;
  parentSessionId: string;
  abortController: AbortController;
  onOutputUpdate?: (output: string) => void;
}

/**
 * Result from executing a subagent
 */
export interface SubAgentResult {
  success: boolean;
  response: string;
  error?: string;
}

/**
 * Build system message for the agent
 */
async function buildAgentSystemMessage(
  agent: AgentConfig,
  services: any,
): Promise<string> {
  const baseMessage = services.systemMessage
    ? await services.systemMessage.getSystemMessage(
        services.toolPermissions.getState().currentMode,
      )
    : "";

  const agentPrompt = agent.systemPrompt || "";

  // Combine base system message with agent-specific prompt
  if (agentPrompt) {
    return `${baseMessage}\n\n${agentPrompt}`;
  }

  return baseMessage;
}

/**
 * Execute a subagent in a child session
 */
export async function executeSubAgent(
  options: SubAgentExecutionOptions,
): Promise<SubAgentResult> {
  const mainAgentPermissionsState =
    await serviceContainer.get<ToolPermissionServiceState>(
      SERVICE_NAMES.TOOL_PERMISSIONS,
    );

  const { agent: subAgent, prompt, abortController, onOutputUpdate } = options;

  try {
    logger.debug("Starting subagent execution", {
      agent: subAgent.name,
    });

    // Lazy import services to avoid circular dependency
    const { services } = await import("../services/index.js");

    // Get model and LLM API from model service
    const modelState = services.model.getSubagentModel();
    const { model, llmApi } = modelState ?? {};

    if (!model || !llmApi) {
      throw new Error("Model or LLM API not available");
    }

    logger.debug("debug1 model and llmapi", { model, llmApi, subAgent });

    // allow all tools for now
    // todo: eventually we want to show the same prompt in a dialog whether asking whether that tool call is allowed or not

    serviceContainer.set<ToolPermissionServiceState>(
      SERVICE_NAMES.TOOL_PERMISSIONS,
      {
        ...mainAgentPermissionsState,
        permissions: {
          policies: [{ tool: "*", permission: "allow" }],
        },
      },
    );

    // Build agent system message
    const systemMessage = await buildAgentSystemMessage(subAgent, services);

    // Store original system message function
    const originalGetSystemMessage = services.systemMessage?.getSystemMessage;

    // Store original ChatHistoryService ready state
    const chatHistorySvc = services.chatHistory;
    const originalIsReady =
      chatHistorySvc && typeof chatHistorySvc.isReady === "function"
        ? chatHistorySvc.isReady
        : undefined;

    // Override system message for this execution
    if (services.systemMessage) {
      services.systemMessage.getSystemMessage = async () => systemMessage;
    }

    // Temporarily disable ChatHistoryService to prevent it from interfering with child session
    if (chatHistorySvc && originalIsReady) {
      chatHistorySvc.isReady = () => false;
    }

    const chatHistory = [
      {
        message: {
          role: "user",
          content: prompt,
        },
        contextItems: [],
      },
    ] as ChatHistoryItem[];

    try {
      let accumulatedOutput = "";

      // Execute the chat stream with child session
      await streamChatResponse(
        chatHistory,
        model,
        llmApi,
        abortController,
        {
          onContent: (content: string) => {
            accumulatedOutput += content;
            if (onOutputUpdate) {
              onOutputUpdate(accumulatedOutput);
            }
          },
          onToolResult: (result: string) => {
            // todo: skip tool outputs - show tool names and params
            accumulatedOutput += `\n\n${result}`;
            if (onOutputUpdate) {
              onOutputUpdate(accumulatedOutput);
            }
          },
        },
        false, // Not compacting
      );

      // The last message (mostly) contains the important output to be submitted back to the main agent
      const lastMessage = chatHistory.at(-1);
      const response =
        typeof lastMessage?.message?.content === "string"
          ? lastMessage.message.content
          : "";

      logger.debug("debug1 response was", {
        response,
        history: chatHistory,
      });

      logger.debug("Subagent execution completed", {
        agent: subAgent.name,
        responseLength: response.length,
      });

      return {
        success: true,
        response,
      };
    } finally {
      // Restore original system message function
      if (services.systemMessage && originalGetSystemMessage) {
        services.systemMessage.getSystemMessage = originalGetSystemMessage;
      }

      // Restore original ChatHistoryService ready state
      if (chatHistorySvc && originalIsReady) {
        chatHistorySvc.isReady = originalIsReady;
      }

      // Restore original main agent tool permissions
      serviceContainer.set<ToolPermissionServiceState>(
        SERVICE_NAMES.TOOL_PERMISSIONS,
        mainAgentPermissionsState,
      );
    }
  } catch (error: any) {
    logger.error("Subagent execution failed", {
      agent: subAgent.name,
      error: error.message,
    });

    return {
      success: false,
      response: "",
      error: error.message,
    };
  }
}
