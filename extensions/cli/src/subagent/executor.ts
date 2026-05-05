import type { ChatHistoryItem } from "core";

import {
  EXPLORE_MODE_POLICIES,
  VERIFY_MODE_POLICIES,
} from "../permissions/defaultPolicies.js";
import { PermissionMode } from "../permissions/types.js";
import { services } from "../services/index.js";
import { serviceContainer } from "../services/ServiceContainer.js";
import type { ToolPermissionServiceState } from "../services/ToolPermissionService.js";
import { ModelServiceState, SERVICE_NAMES } from "../services/types.js";
import { streamChatResponse } from "../stream/streamChatResponse.js";
import { escapeEvents } from "../util/cli.js";
import { logger } from "../util/logger.js";

/**
 * Options for executing a subagent
 */
export interface SubAgentExecutionOptions {
  agent: ModelServiceState;
  prompt: string;
  profile?: "explore" | "verify";
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
  agent: ModelServiceState,
  services: any,
  mode: PermissionMode,
): Promise<string> {
  const baseMessage = services.systemMessage
    ? await services.systemMessage.getSystemMessage(mode)
    : "";

  const agentPrompt = agent.model?.chatOptions?.baseSystemMessage || "";

  // Combine base system message with agent-specific prompt
  if (agentPrompt) {
    return `${baseMessage}\n\n${agentPrompt}`;
  }

  return baseMessage;
}

function getSubagentExecutionMode(
  profile: SubAgentExecutionOptions["profile"],
  parentMode: PermissionMode,
): PermissionMode {
  if (profile === "explore") {
    return "explore";
  }

  if (profile === "verify") {
    return "verify";
  }

  return parentMode;
}

function getModePolicyOverride(
  mode: PermissionMode,
): ToolPermissionServiceState["permissions"] | undefined {
  if (mode === "explore") {
    return { policies: [...EXPLORE_MODE_POLICIES] };
  }

  if (mode === "verify") {
    return { policies: [...VERIFY_MODE_POLICIES] };
  }

  return undefined;
}

/**
 * Execute a subagent in a child session
 */
// eslint-disable-next-line complexity
export async function executeSubAgent(
  options: SubAgentExecutionOptions,
): Promise<SubAgentResult> {
  const {
    agent: subAgent,
    prompt,
    profile,
    abortController,
    onOutputUpdate,
  } = options;

  const mainAgentPermissionsState =
    await serviceContainer.get<ToolPermissionServiceState>(
      SERVICE_NAMES.TOOL_PERMISSIONS,
    );

  try {
    logger.debug("Starting subagent execution", {
      agent: subAgent.model?.name,
      profile,
    });

    const { model, llmApi } = subAgent;
    if (!model || !llmApi) {
      throw new Error("Model or LLM API not available");
    }

    const executionMode = getSubagentExecutionMode(
      profile,
      mainAgentPermissionsState.currentMode,
    );
    const modePermissionOverride = getModePolicyOverride(executionMode);

    serviceContainer.set<ToolPermissionServiceState>(
      SERVICE_NAMES.TOOL_PERMISSIONS,
      {
        ...mainAgentPermissionsState,
        currentMode: executionMode,
        permissions:
          modePermissionOverride ?? mainAgentPermissionsState.permissions,
      },
    );

    // Build agent system message
    const systemMessage = await buildAgentSystemMessage(
      subAgent,
      services,
      executionMode,
    );

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

    const escapeHandler = () => {
      abortController.abort();
      chatHistory.push({
        message: {
          role: "user",
          content: "Subagent execution was cancelled by the user.",
        },
        contextItems: [],
      });
    };

    escapeEvents.on("user-escape", escapeHandler);

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

      logger.debug("Subagent execution completed", {
        agent: model?.name,
        responseLength: response.length,
      });

      return {
        success: true,
        response,
      };
    } finally {
      if (escapeHandler) {
        escapeEvents.removeListener("user-escape", escapeHandler);
      }

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
      agent: subAgent.model?.name,
      error: error.message,
    });

    return {
      success: false,
      response: "",
      error: error.message,
    };
  }
}
