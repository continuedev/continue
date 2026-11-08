import type { ChatHistoryItem, ToolStatus } from "core/index.js";
import { stripImages } from "core/util/messageContent.js";
import { createHistoryItem } from "core/util/messageConversion.js";

import { isAutoReviewEnabled } from "src/permissions/coreRules.js";
import { checkToolPermission } from "src/permissions/permissionChecker.js";
import { withReadOnlyMcp } from "src/permissions/readOnlyMcp.js";

import { loopItemRunning } from "../loop/loopSession.js";
import {
  SERVICE_NAMES,
  serviceContainer,
  services,
} from "../services/index.js";
import type { ToolPermissionServiceState } from "../services/ToolPermissionService.js";
import {
  convertToolToChatCompletionTool,
  getAllAvailableTools,
  Tool,
  ToolCall,
} from "../tools/index.js";
import { logger } from "../util/logger.js";

import {
  executeStreamedToolCalls,
  preprocessStreamedToolCalls,
} from "./streamChatResponse.helpers.js";
import { StreamCallbacks } from "./streamChatResponse.types.js";

interface HandleToolCallsOptions {
  toolCalls: ToolCall[];
  chatHistory: ChatHistoryItem[];
  content: string;
  callbacks: StreamCallbacks | undefined;
  isHeadless: boolean;
  usage?: any;
  /** The turn's signal, passed on to tool runs. */
  abortSignal?: AbortSignal;
}

/** Records a tool's result on the local history's assistant message. */
function setLocalToolResult(
  chatHistory: ChatHistoryItem[],
  toolCallId: string,
  content: string,
  status: ToolStatus,
): void {
  const owner = chatHistory.findLast(
    (item) =>
      item.message.role === "assistant" &&
      item.toolCallStates?.some((ts) => ts.toolCallId === toolCallId),
  );
  const toolState = owner?.toolCallStates?.find(
    (ts) => ts.toolCallId === toolCallId,
  );
  if (toolState) {
    toolState.status = status;
    toolState.output = [
      { content, name: `Tool Result`, description: "Tool execution result" },
    ];
  }
}

export async function handleToolCalls(
  options: HandleToolCallsOptions,
): Promise<boolean> {
  const {
    toolCalls,
    chatHistory,
    content,
    callbacks,
    isHeadless,
    usage,
    abortSignal,
  } = options;
  const chatHistorySvc = services.chatHistory;
  const useService =
    typeof chatHistorySvc?.isReady === "function" && chatHistorySvc.isReady();
  if (toolCalls.length === 0) {
    if (content) {
      if (useService) {
        // Service-driven: write assistant message via service
        chatHistorySvc.addAssistantMessage(content, undefined, usage);
      } else {
        // Fallback only when service is unavailable
        const message: any = {
          role: "assistant",
          content,
        };
        if (usage) {
          message.usage = usage;
        }
        chatHistory.push(createHistoryItem(message));
      }
    }
    return false;
  }

  // Create tool call states for the ChatHistoryItem
  const toolCallStates = toolCalls.map((tc) => ({
    toolCallId: tc.id,
    toolCall: {
      id: tc.id,
      type: "function" as const,
      function: {
        name: tc.name,
        arguments: JSON.stringify(tc.arguments),
      },
    },
    status: "generated" as ToolStatus,
    parsedArgs: tc.arguments,
  }));

  // Create assistant message with tool calls
  const assistantMessage = {
    role: "assistant" as const,
    content: content || "",
    toolCalls: toolCalls.map((tc) => ({
      id: tc.id,
      type: "function" as const,
      function: {
        name: tc.name,
        arguments: JSON.stringify(tc.arguments),
      },
      ...(tc.extra_content && { extra_content: tc.extra_content }),
    })),
  };

  if (useService) {
    // Important: pass ChatCompletion-style toolCalls, not internal ToolCall[]
    chatHistorySvc.addAssistantMessage(
      assistantMessage.content || "",
      assistantMessage.toolCalls,
      usage,
    );
  } else {
    // Fallback only when service is unavailable
    const messageWithUsage = usage
      ? { ...assistantMessage, usage }
      : assistantMessage;
    chatHistory.push(createHistoryItem(messageWithUsage, [], toolCallStates));
  }

  // First preprocess the tool calls
  const { preprocessedCalls, errorChatEntries } =
    await preprocessStreamedToolCalls(isHeadless, toolCalls, callbacks);

  // Add any preprocessing errors to the toolCallStates on the assistant message
  // (NOT as separate history items, which would cause duplicate tool_result messages)
  errorChatEntries.forEach((errorEntry) => {
    const errorContent = stripImages(errorEntry.content) || "";
    if (useService) {
      chatHistorySvc.addToolResult(
        errorEntry.tool_call_id,
        errorContent,
        "errored",
      );
    } else {
      // Fallback only when service is unavailable: update local tool state
      setLocalToolResult(
        chatHistory,
        errorEntry.tool_call_id,
        errorContent,
        "errored",
      );
    }
  });

  // Execute the valid preprocessed tool calls
  // Note: executeStreamedToolCalls adds tool results to toolCallStates via
  // services.chatHistory.addToolResult() internally
  const { hasRejection, chatHistoryEntries } = await executeStreamedToolCalls(
    preprocessedCalls,
    callbacks,
    isHeadless,
    abortSignal,
  );

  // A subagent keeps its own history and turns the service off, so the results
  // written to the service never reached it: it saw every call as unanswered.
  if (!useService) {
    for (const entry of chatHistoryEntries) {
      setLocalToolResult(
        chatHistory,
        entry.tool_call_id,
        stripImages(entry.content) || "",
        entry.status,
      );
    }
  }

  if (isHeadless && hasRejection) {
    logger.debug(
      "Tool call rejected in headless mode - returning current content",
    );
    return true; // Signal early return needed
  }

  // Tool results are already added to toolCallStates in executeStreamedToolCalls
  // via services.chatHistory.addToolResult() - no need to add them again here.
  // Adding them again would be redundant (and previously caused duplicate tool_result messages
  // when combined with separate tool history items).
  return false;
}

export async function getRequestTools(isHeadless: boolean) {
  const availableTools = await getAllAvailableTools(isHeadless);

  const permissionsState =
    await serviceContainer.get<ToolPermissionServiceState>(
      SERVICE_NAMES.TOOL_PERMISSIONS,
    );

  const allowedTools: Tool[] = [];
  for (const tool of availableTools) {
    const result = withReadOnlyMcp(
      checkToolPermission(
        { name: tool.name, arguments: {} },
        permissionsState.permissions,
      ),
      tool,
    );

    // Headless runs have no one to ask, so "ask" tools are normally not offered.
    // With --auto-review the reviewer model answers instead of a person, so they are.
    // Under Loop mode an item's "ask" call is held as a question for the
    // person (src/loop/loopHolds.ts), so they are offered too.
    if (
      result.permission === "allow" ||
      (result.permission === "ask" &&
        (!isHeadless || isAutoReviewEnabled() || loopItemRunning()))
    ) {
      allowedTools.push(tool);
    }
  }

  return allowedTools.map(convertToolToChatCompletionTool);
}
