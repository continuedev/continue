import type { ChatHistoryItem } from "core";

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
): Promise<string> {
  const baseMessage = services.systemMessage
    ? await services.systemMessage.getSystemMessage(
        services.toolPermissions.getState().currentMode,
      )
    : "";

  const agentPrompt = agent.model?.chatOptions?.baseSystemMessage || "";

  // Combine base system message with agent-specific prompt
  if (agentPrompt) {
    return `${baseMessage}\n\n${agentPrompt}`;
  }

  return baseMessage;
}

let subagentExecutionChain: Promise<void> = Promise.resolve();

/**
 * Run `fn` exclusively with respect to other subagent executions.
 *
 * @remarks
 * {@link executeSubAgent} temporarily flips the shared `TOOL_PERMISSIONS`
 * service state to allow-all and restores the main agent's permissions in a
 * `finally`. If two executions run concurrently the read/restore interleaves:
 * the second reads the allow-all state as its "main" and later restores *that*,
 * leaving the main agent permanently escalated to allow-all. Chaining every
 * execution onto a single promise guarantees one-at-a-time execution, so the
 * restore is never lost. A rejected `fn` still releases the lock.
 *
 * @typeParam T - Resolved type of `fn`.
 * @param fn - The async execution to serialize; awaited while the lock is held.
 * @returns The value resolved by `fn`.
 */
async function withSubagentExecutionLock<T>(fn: () => Promise<T>): Promise<T> {
  const previous = subagentExecutionChain;
  let release!: () => void;
  subagentExecutionChain = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}

/**
 * Execute a subagent in a child session.
 *
 * @remarks
 * Serialized via {@link withSubagentExecutionLock} so concurrent subagents can
 * never interleave the shared `TOOL_PERMISSIONS` read/restore — which would
 * otherwise strand the main agent's permissions at allow-all. The public
 * signature is identical to the pre-serialization implementation; only mutual
 * exclusion is added (no behavior change for a single subagent).
 *
 * @param options - Subagent, prompt, parent session id, abort controller, and
 *   optional output callback. See {@link SubAgentExecutionOptions}.
 * @returns The subagent result: success flag, accumulated response text, and an
 *   optional error message when execution fails.
 */
export async function executeSubAgent(
  options: SubAgentExecutionOptions,
): Promise<SubAgentResult> {
  return withSubagentExecutionLock(() => executeSubAgentImpl(options));
}

/**
 * Implementation of {@link executeSubAgent}.
 *
 * @remarks
 * Always invoke via {@link executeSubAgent}; calling this directly re-opens the
 * concurrent permission-escalation race this module exists to close.
 *
 * @param options - See {@link SubAgentExecutionOptions}.
 * @returns The subagent result. See {@link executeSubAgent}.
 */
// eslint-disable-next-line complexity
async function executeSubAgentImpl(
  options: SubAgentExecutionOptions,
): Promise<SubAgentResult> {
  const { agent: subAgent, prompt, abortController, onOutputUpdate } = options;

  const mainAgentPermissionsState =
    await serviceContainer.get<ToolPermissionServiceState>(
      SERVICE_NAMES.TOOL_PERMISSIONS,
    );

  try {
    logger.debug("Starting subagent execution", {
      agent: subAgent.model?.name,
    });

    const { model, llmApi } = subAgent;
    if (!model || !llmApi) {
      throw new Error("Model or LLM API not available");
    }

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
