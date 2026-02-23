import type { ChatHistoryItem, ToolStatus } from "core/index.js";
import { stripImages } from "core/util/messageContent.js";
import { createHistoryItem } from "core/util/messageConversion.js";

import { checkToolPermission } from "src/permissions/permissionChecker.js";

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
}

export async function handleToolCalls(
  options: HandleToolCallsOptions,
): Promise<boolean> {
  const { toolCalls, chatHistory, content, callbacks, isHeadless, usage } =
    options;
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
      const lastAssistantIndex = chatHistory.findLastIndex(
        (item) => item.message.role === "assistant" && item.toolCallStates,
      );
      if (
        lastAssistantIndex >= 0 &&
        chatHistory[lastAssistantIndex].toolCallStates
      ) {
        const toolState = chatHistory[lastAssistantIndex].toolCallStates.find(
          (ts) => ts.toolCallId === errorEntry.tool_call_id,
        );
        if (toolState) {
          toolState.status = "errored";
          toolState.output = [
            {
              content: errorContent,
              name: `Tool Result`,
              description: "Tool execution result",
            },
          ];
        }
      }
    }
  });

  // Execute the valid preprocessed tool calls
  // Note: executeStreamedToolCalls adds tool results to toolCallStates via
  // services.chatHistory.addToolResult() internally
  const { hasRejection } = await executeStreamedToolCalls(
    preprocessedCalls,
    callbacks,
    isHeadless,
  );

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
    const result = checkToolPermission(
      { name: tool.name, arguments: {} },
      permissionsState.permissions,
    );

    if (
      result.permission === "allow" ||
      (result.permission === "ask" && !isHeadless)
    ) {
      allowedTools.push(tool);
    }
  }

  return allowedTools.map(convertToolToChatCompletionTool);
}
