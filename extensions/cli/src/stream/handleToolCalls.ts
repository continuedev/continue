import type { ChatHistoryItem, ToolStatus } from "core/index.js";
import { stripImages } from "core/util/messageContent.js";
import { createHistoryItem } from "core/util/messageConversion.js";
import type { ChatCompletionTool } from "openai/resources.mjs";

import { filterExcludedTools } from "../permissions/index.js";
import {
  getServiceSync,
  MCPServiceState,
  MCPTool,
  SERVICE_NAMES,
  services,
} from "../services/index.js";
import type { ToolPermissionServiceState } from "../services/ToolPermissionService.js";
import { getAllBuiltinTools, ToolCall } from "../tools/index.js";
import { logger } from "../util/logger.js";

import {
  executeStreamedToolCalls,
  preprocessStreamedToolCalls,
} from "./streamChatResponse.helpers.js";
import { StreamCallbacks } from "./streamChatResponse.types.js";

export async function handleToolCalls(
  toolCalls: ToolCall[],
  chatHistory: ChatHistoryItem[],
  content: string,
  callbacks: StreamCallbacks | undefined,
  isHeadless: boolean,
): Promise<boolean> {
  const chatHistorySvc = services.chatHistory;
  const useService =
    typeof chatHistorySvc?.isReady === "function" && chatHistorySvc.isReady();
  if (toolCalls.length === 0) {
    if (content) {
      if (useService) {
        // Service-driven: write assistant message via service
        chatHistorySvc.addAssistantMessage(content);
      } else {
        // Fallback only when service is unavailable
        chatHistory.push(
          createHistoryItem({
            role: "assistant",
            content,
          }),
        );
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
    );
  } else {
    // Fallback only when service is unavailable
    chatHistory.push(createHistoryItem(assistantMessage, [], toolCallStates));
  }

  // First preprocess the tool calls
  const { preprocessedCalls, errorChatEntries } =
    await preprocessStreamedToolCalls(toolCalls, callbacks);

  // Add any preprocessing errors to chat history
  // Convert error entries from OpenAI format to ChatHistoryItem format
  errorChatEntries.forEach((errorEntry) => {
    const item = createHistoryItem({
      role: "tool",
      content: stripImages(errorEntry.content) || "",
      toolCallId: errorEntry.tool_call_id,
    });
    if (useService) {
      chatHistorySvc.addHistoryItem(item);
    } else {
      // Fallback only when service is unavailable
      chatHistory.push(item);
    }
  });

  // Execute the valid preprocessed tool calls
  const { chatHistoryEntries: toolResults, hasRejection } =
    await executeStreamedToolCalls(preprocessedCalls, callbacks, isHeadless);

  if (isHeadless && hasRejection) {
    logger.debug(
      "Tool call rejected in headless mode - returning current content",
    );
    return true; // Signal early return needed
  }

  // Convert tool results and add them to the chat history with per-result status
  toolResults.forEach((toolResult) => {
    const resultContent =
      typeof toolResult.content === "string" ? toolResult.content : "";

    // Derive per-result status instead of applying batch-wide hasRejection
    let status: ToolStatus = "done";
    const lower = resultContent.toLowerCase();
    if (
      lower.includes("permission denied by user") ||
      lower.includes("cancelled due to previous tool rejection") ||
      lower.includes("canceled due to previous tool rejection")
    ) {
      status = "canceled";
    } else if (
      lower.startsWith("error executing tool") ||
      lower.startsWith("error:")
    ) {
      status = "errored" as ToolStatus;
    }

    if (useService) {
      chatHistorySvc.addToolResult(
        toolResult.tool_call_id,
        resultContent,
        status,
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
          (ts) => ts.toolCallId === toolResult.tool_call_id,
        );
        if (toolState) {
          toolState.status = status;
          toolState.output = [
            {
              content: resultContent,
              name: `Tool Result`,
              description: "Tool execution result",
            },
          ];
        }
      }
    }
  });
  return false;
}

export async function getAllTools() {
  // Get all available tool names
  const allBuiltinTools = getAllBuiltinTools();
  const builtinToolNames = allBuiltinTools.map((tool) => tool.name);

  let mcpTools: MCPTool[] = [];
  let mcpToolNames: string[] = [];
  const mcpServiceResult = getServiceSync<MCPServiceState>(SERVICE_NAMES.MCP);
  if (mcpServiceResult.state === "ready") {
    mcpTools = mcpServiceResult?.value?.tools ?? [];
    mcpToolNames = mcpTools.map((t) => t.name);
  } else {
    // MCP is lazy
    // throw new Error("MCP Service not initialized");
  }

  const allToolNames = [...builtinToolNames, ...mcpToolNames];

  // Check if the ToolPermissionService is ready
  const permissionsServiceResult = getServiceSync<ToolPermissionServiceState>(
    SERVICE_NAMES.TOOL_PERMISSIONS,
  );

  let allowedToolNames: string[];
  if (
    permissionsServiceResult.state === "ready" &&
    permissionsServiceResult.value
  ) {
    // Filter out excluded tools based on permissions
    allowedToolNames = filterExcludedTools(
      allToolNames,
      permissionsServiceResult.value.permissions,
    );
  } else {
    // Service not ready - this is a critical error since tools should only be
    // requested after services are properly initialized
    logger.error(
      "ToolPermissionService not ready in getAllTools - this indicates a service initialization timing issue",
    );
    throw new Error(
      "ToolPermissionService not initialized. Services must be initialized before requesting tools.",
    );
  }

  const allowedToolNamesSet = new Set(allowedToolNames);

  // Filter builtin tools
  const allowedBuiltinTools = allBuiltinTools.filter((tool) =>
    allowedToolNamesSet.has(tool.name),
  );

  const allTools: ChatCompletionTool[] = allowedBuiltinTools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object",
        required: tool.parameters.required,
        properties: tool.parameters.properties,
      },
    },
  }));

  // Add filtered MCP tools
  const allowedMcpTools = mcpTools.filter((tool) =>
    allowedToolNamesSet.has(tool.name),
  );

  allTools.push(
    ...allowedMcpTools.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    })),
  );

  return allTools;
}
