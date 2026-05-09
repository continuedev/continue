import type { ChatHistoryItem } from "core";
import {
  buildCoordinatorWorkerSystemMessage,
  getCoordinatorScratchpadPath,
} from "core/agent/coordinator/CoordinatorContext.js";
import {
  appendWorkerScratchpadEntry,
  readWorkerScratchpad,
} from "core/agent/coordinator/WorkerScratchpad.js";
import { isAbortError } from "core/util/isAbortError.js";

import { env } from "../env.js";
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
  profile?: "explore" | "verify" | "coordinator-worker";
  parentSessionId: string;
  abortController: AbortController;
  onOutputUpdate?: (output: string) => void;
}

/**
 * Result from executing a subagent
 */
export interface SubAgentResult {
  success: boolean;
  status: "completed" | "failed" | "cancelled";
  response: string;
  error?: string;
  cancelled?: boolean;
}

/**
 * Build system message for the agent
 */
async function buildAgentSystemMessage(
  agent: ModelServiceState,
  services: any,
  mode: PermissionMode,
  coordinatorInstructions?: string,
): Promise<string> {
  const baseMessage = services.systemMessage
    ? await services.systemMessage.getSystemMessage(mode)
    : "";

  const agentPrompt = agent.model?.chatOptions?.baseSystemMessage || "";

  // Combine base system message with agent-specific prompt
  const segments = [baseMessage, agentPrompt, coordinatorInstructions].filter(
    (segment): segment is string => !!segment && segment.trim().length > 0,
  );

  if (segments.length > 0) {
    return segments.join("\n\n");
  }

  return "";
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

  if (profile === "coordinator-worker") {
    return "coordinator";
  }

  return parentMode;
}

function shouldUseCoordinatorScratchpad(
  profile: SubAgentExecutionOptions["profile"],
  parentMode: PermissionMode,
): boolean {
  return parentMode === "coordinator" || profile === "coordinator-worker";
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
    parentSessionId,
    abortController,
    onOutputUpdate,
  } = options;

  const mainAgentPermissionsState =
    await serviceContainer.get<ToolPermissionServiceState>(
      SERVICE_NAMES.TOOL_PERMISSIONS,
    );
  const scratchpadPath = shouldUseCoordinatorScratchpad(
    profile,
    mainAgentPermissionsState.currentMode,
  )
    ? getCoordinatorScratchpadPath(env.continueHome, parentSessionId)
    : undefined;

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
    const coordinatorInstructions = scratchpadPath
      ? buildCoordinatorWorkerSystemMessage({
          scratchpadPath,
          scratchpadContent: await readWorkerScratchpad(
            scratchpadPath,
            parentSessionId,
          ),
        })
      : undefined;

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
      coordinatorInstructions,
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

      if (abortController.signal.aborted) {
        const response = "Subagent execution was cancelled before completion.";

        if (scratchpadPath) {
          await appendWorkerScratchpadEntry(scratchpadPath, parentSessionId, {
            agentName: model?.name ?? "subagent",
            prompt,
            response,
            status: "cancelled",
            profile,
          });
        }

        return {
          success: false,
          status: "cancelled",
          response,
          error: response,
          cancelled: true,
        };
      }

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

      if (scratchpadPath) {
        await appendWorkerScratchpadEntry(scratchpadPath, parentSessionId, {
          agentName: model?.name ?? "subagent",
          prompt,
          response,
          status: "completed",
          profile,
        });
      }

      return {
        success: true,
        status: "completed",
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
    const wasCancelled = abortController.signal.aborted || isAbortError(error);
    const response = wasCancelled
      ? "Subagent execution was cancelled before completion."
      : error.message;

    if (scratchpadPath) {
      await appendWorkerScratchpadEntry(scratchpadPath, parentSessionId, {
        agentName: subAgent.model?.name ?? "subagent",
        prompt,
        response,
        status: wasCancelled ? "cancelled" : "failed",
        profile,
      });
    }

    logger.error("Subagent execution failed", {
      agent: subAgent.model?.name,
      error: response,
    });

    return {
      success: false,
      status: wasCancelled ? "cancelled" : "failed",
      response,
      error: response,
      cancelled: wasCancelled,
    };
  }
}
