import { randomUUID } from "node:crypto";

import type { ChatHistoryItem } from "core";

import { fireSubagentStart, fireSubagentStop } from "../hooks/fireHook.js";
import { toolPermissionManager } from "../permissions/permissionManager.js";
import { services } from "../services/index.js";
import { serviceContainer } from "../services/ServiceContainer.js";
import type { ToolPermissionServiceState } from "../services/ToolPermissionService.js";
import { ModelServiceState, SERVICE_NAMES } from "../services/types.js";
import { streamChatResponse } from "../stream/streamChatResponse.js";
import type { StreamCallbacks } from "../stream/streamChatResponse.types.js";
import type { ToolCallPreview, ToolPermissionPrompt } from "../tools/types.js";
import { escapeEvents } from "../util/cli.js";
import { logger } from "../util/logger.js";

import { subagentPermissions } from "./permissions.js";
import {
  SubAgentStatus,
  SubAgentToolCall,
  SubAgentTranscript,
  summarizeToolArgs,
} from "./transcript.js";

export type { SubAgentStatus, SubAgentToolCall } from "./transcript.js";

/**
 * Options for executing a subagent
 */
export interface SubAgentExecutionOptions {
  agent: ModelServiceState;
  /** The agent's name: `agent_type` for hooks and the label on its prompts. */
  agentName?: string;
  prompt: string;
  parentSessionId: string;
  /** Aborting it cancels the run; link it to the parent turn's signal. */
  abortController: AbortController;
  /** Progress for the parent's UI: tool names and text, no tool output. */
  onOutputUpdate?: (output: string) => void;
  /**
   * The parent's permission prompt. When given and the session is not
   * headless, the subagent's "ask" calls go to it; otherwise they are refused.
   */
  onToolPermissionRequest?: ToolPermissionPrompt;
}

/**
 * Result from executing a subagent
 */
export interface SubAgentResult {
  /** Whether the run completed; kept for callers that only need yes or no. */
  success: boolean;
  status: SubAgentStatus;
  /**
   * The subagent's final answer when it completed, otherwise everything it
   * wrote so far. Never contains tool output.
   */
  response: string;
  /** Why the run did not complete. */
  error?: string;
  toolCalls: SubAgentToolCall[];
}

/**
 * Claude Code caps consecutive Stop-hook continuations at 8; the same cap
 * applies to SubagentStop here so a hook that always blocks cannot keep a
 * subagent running forever.
 */
export const MAX_SUBAGENT_STOP_CONTINUATIONS = 8;

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

function abortReason(signal: AbortSignal): string {
  const reason: unknown = signal.reason;
  if (typeof reason === "string" && reason) return reason;
  if (reason instanceof Error && reason.name !== "AbortError") {
    return reason.message;
  }
  return "Cancelled by the user";
}

let subagentRuns: Promise<unknown> = Promise.resolve();

/**
 * Execute a subagent in a child session.
 *
 * Runs one at a time: a run swaps the shared tool-permission, system-message
 * and chat-history services and restores them afterwards, so two subagents
 * started by parallel tool calls would otherwise overwrite each other's
 * state and could leave the parent with a subagent's permissions. A run
 * whose parent was cancelled while it waited does not start.
 */
export function executeSubAgent(
  options: SubAgentExecutionOptions,
): Promise<SubAgentResult> {
  const run = subagentRuns.then(() => {
    const { signal } = options.abortController;
    if (signal.aborted) {
      return {
        success: false,
        status: "cancelled" as const,
        response: "",
        error: abortReason(signal),
        toolCalls: [],
      };
    }
    return runSubAgent(options);
  });
  subagentRuns = run.catch(() => undefined);
  return run;
}

/**
 * Holds the subagent's permissions in the service container for the run.
 *
 * The parent's permissions can change while the subagent runs: "always
 * allow" on a prompt reloads them, and a mode switch replaces them. Either
 * writes the parent's state into the container, which would hand the
 * subagent the parent's policies (including the Subagent tool), and
 * restoring the state captured at the start would then drop the change. So
 * a write that is not ours is taken as the parent's new state: the
 * subagent's policies are derived from it again, and it is what is restored.
 */
function holdSubagentPermissions(
  parent: ToolPermissionServiceState,
  canPrompt: boolean,
): { restore: () => void } {
  const eventName = `${SERVICE_NAMES.TOOL_PERMISSIONS}:ready`;
  let latestParent = parent;
  const derive = (p: ToolPermissionServiceState) => ({
    ...p,
    permissions: subagentPermissions(p.permissions, { canPrompt }),
  });
  let mine = derive(parent);

  const onChange = (value: ToolPermissionServiceState) => {
    if (value === mine) return;
    latestParent = value;
    mine = derive(value);
    serviceContainer.set<ToolPermissionServiceState>(
      SERVICE_NAMES.TOOL_PERMISSIONS,
      mine,
    );
  };

  serviceContainer.set<ToolPermissionServiceState>(
    SERVICE_NAMES.TOOL_PERMISSIONS,
    mine,
  );
  serviceContainer.on?.(eventName, onChange);

  return {
    restore: () => {
      serviceContainer.off?.(eventName, onChange);
      serviceContainer.set<ToolPermissionServiceState>(
        SERVICE_NAMES.TOOL_PERMISSIONS,
        latestParent,
      );
    },
  };
}

/**
 * The subagent's prompt callback: the parent's prompt, labelled with the
 * subagent's name. Requests still open when the run is cancelled are
 * rejected, so the subagent does not wait on a prompt nobody will answer.
 */
function labelledPrompt(
  agentName: string,
  parentPrompt: ToolPermissionPrompt,
): { prompt: ToolPermissionPrompt; rejectPending: () => void } {
  const pending = new Set<string>();
  const prompt: ToolPermissionPrompt = (
    toolName,
    toolArgs,
    requestId,
    preview,
  ) => {
    pending.add(requestId);
    const summary = summarizeToolArgs(toolArgs);
    const label: ToolCallPreview = {
      type: "text",
      content: `Subagent "${agentName}" asks to run ${toolName}`,
      color: "yellow",
    };
    // Without a preview the dialog would describe the call itself; keep that.
    const body: ToolCallPreview[] = preview?.length
      ? preview
      : [
          {
            type: "text",
            content: `Will call ${toolName}${summary ? `: ${summary}` : ""}`,
          },
        ];
    parentPrompt(toolName, toolArgs, requestId, [label, ...body]);
  };
  return {
    prompt,
    rejectPending: () => {
      for (const id of pending) {
        if (toolPermissionManager.getPendingRequest(id)) {
          toolPermissionManager.rejectRequest(id);
        }
      }
      pending.clear();
    },
  };
}

// eslint-disable-next-line complexity, max-statements
async function runSubAgent(
  options: SubAgentExecutionOptions,
): Promise<SubAgentResult> {
  const { agent: subAgent, prompt, abortController, onOutputUpdate } = options;
  const { signal } = abortController;
  const agentType = options.agentName || subAgent.model?.name || "subagent";
  const agentId = `agent-${randomUUID()}`;
  const transcript = new SubAgentTranscript(onOutputUpdate);

  const mainAgentPermissionsState =
    await serviceContainer.get<ToolPermissionServiceState>(
      SERVICE_NAMES.TOOL_PERMISSIONS,
    );

  const finish = (
    status: SubAgentStatus,
    response: string,
    error?: string,
  ): SubAgentResult => ({
    success: status === "completed",
    status,
    response,
    ...(error ? { error } : {}),
    toolCalls: transcript.toolCalls,
  });

  try {
    logger.debug("Starting subagent execution", {
      agent: subAgent.model?.name,
    });

    const { model, llmApi } = subAgent;
    if (!model || !llmApi) {
      throw new Error("Model or LLM API not available");
    }

    // SubagentStart cannot block (Claude Code: exit 2 "shows stderr to user
    // only"); its additionalContext goes to the subagent before its prompt.
    const start = await fireSubagentStart(agentId, agentType);
    if (start.blocked && start.blockReason) {
      transcript.notice(`SubagentStart hook error: ${start.blockReason}`);
    }
    const firstPrompt = start.additionalContext
      ? `${start.additionalContext}\n\n${prompt}`
      : prompt;

    // Only what the parent may do without asking, plus "ask" calls routed to
    // the parent's prompt when one can be shown; see subagentPermissions.
    const parentPrompt = mainAgentPermissionsState.isHeadless
      ? undefined
      : options.onToolPermissionRequest;
    const prompts = parentPrompt
      ? labelledPrompt(agentType, parentPrompt)
      : undefined;

    // Build agent system message (before anything is swapped, so a failure
    // here leaves nothing to restore)
    const systemMessage = await buildAgentSystemMessage(subAgent, services);

    const permissions = holdSubagentPermissions(
      mainAgentPermissionsState,
      !!prompts,
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
          content: firstPrompt,
        },
        contextItems: [],
      },
    ] as ChatHistoryItem[];

    const escapeHandler = () => {
      abortController.abort();
    };
    escapeEvents.on("user-escape", escapeHandler);
    const onAbort = () => prompts?.rejectPending();
    signal.addEventListener("abort", onAbort, { once: true });

    const callbacks: StreamCallbacks = {
      onContent: (content) => transcript.onContent(content),
      onToolStart: (name, args) => transcript.onToolStart(name, args),
      // The output stays in the subagent's own history; the parent gets the
      // tool's name and status.
      onToolResult: (_result, name, status) =>
        transcript.onToolResult(name, status),
      onToolError: (_error, name) =>
        transcript.onToolResult(name ?? "", "errored"),
      onToolPermissionRequest: prompts?.prompt,
    };

    try {
      let continuations = 0;
      for (;;) {
        await streamChatResponse(
          chatHistory,
          model,
          llmApi,
          abortController,
          callbacks,
          false, // Not compacting
        );
        if (signal.aborted) break;

        // SubagentStop: exit 2 or decision "block" sends the reason back to
        // the subagent as its next instruction; additionalContext does the
        // same as feedback.
        const stop = await fireSubagentStop({
          agentId,
          agentType,
          stopHookActive: continuations > 0,
          lastAssistantMessage:
            transcript.finalAnswer() || transcript.allText() || undefined,
        });
        const feedback = stop.blocked
          ? stop.blockReason
          : stop.additionalContext;
        if (
          !feedback ||
          signal.aborted ||
          continuations >= MAX_SUBAGENT_STOP_CONTINUATIONS
        ) {
          break;
        }
        continuations++;
        transcript.notice(`SubagentStop hook: ${feedback}`);
        transcript.newTurn();
        chatHistory.push({
          message: { role: "user", content: feedback },
          contextItems: [],
        });
      }

      if (signal.aborted) {
        return finish("cancelled", transcript.allText(), abortReason(signal));
      }

      const answer = transcript.finalAnswer();
      logger.debug("Subagent execution completed", {
        agent: model?.name,
        responseLength: answer.length,
      });

      if (answer) return finish("completed", answer);
      return finish(
        "partial",
        transcript.allText(),
        "The subagent stopped after a tool call without giving a final answer.",
      );
    } finally {
      escapeEvents.removeListener("user-escape", escapeHandler);
      signal.removeEventListener("abort", onAbort);
      prompts?.rejectPending();

      // Restore original system message function
      if (services.systemMessage && originalGetSystemMessage) {
        services.systemMessage.getSystemMessage = originalGetSystemMessage;
      }

      // Restore original ChatHistoryService ready state
      if (chatHistorySvc && originalIsReady) {
        chatHistorySvc.isReady = originalIsReady;
      }

      // Restore the main agent's tool permissions (its latest state)
      permissions.restore();
    }
  } catch (error: any) {
    if (signal.aborted) {
      return finish("cancelled", transcript.allText(), abortReason(signal));
    }
    logger.error("Subagent execution failed", {
      agent: subAgent.model?.name,
      error: error?.message,
    });
    return finish(
      "failed",
      transcript.allText(),
      error?.message ?? String(error),
    );
  }
}
