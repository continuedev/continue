// Helper functions extracted from streamChatResponse.ts to reduce file size

import { ChatCompletionToolMessageParam } from "openai/resources/chat/completions.mjs";

import { checkToolPermission } from "../permissions/permissionChecker.js";
import { toolPermissionManager } from "../permissions/permissionManager.js";
import { ToolCallRequest } from "../permissions/types.js";
import { telemetryService } from "../telemetry/telemetryService.js";
import { calculateTokenCost } from "../telemetry/utils.js";
import {
  executeToolCall,
  getAllBuiltinTools,
  getAvailableTools,
  Tool,
  validateToolCallArgsPresent,
} from "../tools/index.js";
import { PreprocessedToolCall, ToolCall } from "../tools/types.js";
import { logger } from "../util/logger.js";

import { StreamCallbacks } from "./streamChatResponse.types.js";

// Helper function to handle permission denied
export function handlePermissionDenied(
  toolCall: PreprocessedToolCall,
  chatHistoryEntries: ChatCompletionToolMessageParam[],
  callbacks?: StreamCallbacks,
): void {
  const deniedMessage = `Permission denied by user`;
  logger.info("Tool call denied", {
    name: toolCall.name,
    arguments: toolCall.arguments,
  });

  chatHistoryEntries.push({
    role: "tool",
    tool_call_id: toolCall.id,
    content: deniedMessage,
  });

  callbacks?.onToolResult?.(deniedMessage, toolCall.name, "canceled");
  logger.debug("Tool call rejected - stopping stream");
}

// Helper function to handle headless mode permission
export function handleHeadlessPermission(
  toolCall: PreprocessedToolCall,
): never {
  const allBuiltinTools = getAllBuiltinTools();
  const tool = allBuiltinTools.find((t) => t.name === toolCall.name);
  const toolName = tool?.displayName || toolCall.name;

  console.error(
    `Error: Tool '${toolName}' requires permission but cn is running in headless mode.`,
  );
  console.error(`If you want to allow this tool, use --allow ${toolName}.`);
  console.error(
    `If you don't want the tool to be included, use --exclude ${toolName}.`,
  );

  process.exit(1);
}

// Helper function to request user permission
export async function requestUserPermission(
  toolCall: PreprocessedToolCall,
  callbacks?: StreamCallbacks,
): Promise<boolean> {
  if (!callbacks?.onToolPermissionRequest) {
    return false;
  }

  const toolCallRequest: ToolCallRequest = {
    name: toolCall.name,
    arguments: toolCall.preprocessResult?.args ?? toolCall.arguments,
    preview: toolCall.preprocessResult?.preview,
  };

  // Set up listener for permissionRequested event
  const handlePermissionRequested = (event: {
    requestId: string;
    toolCall: ToolCallRequest;
  }) => {
    if (event.toolCall.name === toolCall.name) {
      toolPermissionManager.off(
        "permissionRequested",
        handlePermissionRequested,
      );
      // Notify UI about permission request
      callbacks.onToolPermissionRequest!(
        event.toolCall.name,
        event.toolCall.arguments,
        event.requestId,
        event.toolCall.preview,
      );
    }
  };

  toolPermissionManager.on("permissionRequested", handlePermissionRequested);

  // Request permission using the proper API
  const permissionResult =
    await toolPermissionManager.requestPermission(toolCallRequest);

  // Clean up listener in case the condition above was never met
  // This is a safety net to ensure no listeners are left behind
  toolPermissionManager.off("permissionRequested", handlePermissionRequested);

  return permissionResult.approved;
}

// Helper function to check if tool permission is needed
export async function checkToolPermissionApproval(
  toolCall: PreprocessedToolCall,
  callbacks?: StreamCallbacks,
  isHeadless?: boolean,
): Promise<boolean> {
  const permissionCheck = checkToolPermission(toolCall);

  if (permissionCheck.permission === "allow") {
    return true;
  } else if (permissionCheck.permission === "ask") {
    if (isHeadless) {
      handleHeadlessPermission(toolCall);
    }
    return await requestUserPermission(toolCall, callbacks);
  } else if (permissionCheck.permission === "exclude") {
    // This shouldn't happen as excluded tools are filtered out earlier
    return false;
  }

  return false;
}

// Helper function to track first token time
export function trackFirstTokenTime(
  firstTokenTime: number | null,
  chunk: any,
  requestStartTime: number,
  model: any,
  tools?: any[],
): number | null {
  if (
    firstTokenTime === null &&
    chunk.choices?.[0]?.delta &&
    (chunk.choices[0].delta.content || chunk.choices[0].delta.tool_calls)
  ) {
    const tokenTime = Date.now();
    telemetryService.recordResponseTime(
      tokenTime - requestStartTime,
      model.model,
      "time_to_first_token",
      (tools?.length || 0) > 0,
    );
    return tokenTime;
  }
  return firstTokenTime;
}

// Helper function to process content from a chunk
export function processChunkContent(
  content: string,
  aiResponse: string,
  callbacks?: StreamCallbacks,
  isHeadless?: boolean,
): string {
  const updatedResponse = aiResponse + content;

  if (callbacks?.onContent) {
    callbacks.onContent(content);
  } else if (!isHeadless) {
    process.stdout.write(content);
  }

  return updatedResponse;
}

// Helper function to handle tool call delta
export function processToolCallDelta(
  toolCallDelta: any,
  toolCallsMap: Map<string, ToolCall>,
  indexToIdMap: Map<number, string>,
): void {
  let toolCallId: string | undefined;

  // If we have an ID, use it and map the index
  if (toolCallDelta.id) {
    toolCallId = toolCallDelta.id;
    if (toolCallDelta.index !== undefined && toolCallId) {
      indexToIdMap.set(toolCallDelta.index, toolCallId);
    }
  } else if (toolCallDelta.index !== undefined) {
    // No ID, but we have an index - look up the ID from our map
    toolCallId = indexToIdMap.get(toolCallDelta.index);
  }

  if (!toolCallId) {
    logger.warn("Tool call delta without ID or valid index mapping", {
      toolCallDelta,
    });
    return;
  }

  // Create tool call entry if it doesn't exist
  if (!toolCallsMap.has(toolCallId)) {
    toolCallsMap.set(toolCallId, {
      id: toolCallId,
      name: "",
      arguments: null,
      argumentsStr: "",
      startNotified: false,
    });
  }

  const toolCall = toolCallsMap.get(toolCallId);
  if (!toolCall) {
    logger.warn("Tool call not found in map", { toolCallId });
    return;
  }

  // Update name
  if (toolCallDelta.function?.name) {
    toolCall.name = toolCallDelta.function.name;
  }

  // Accumulate arguments
  if (toolCallDelta.function?.arguments) {
    toolCall.argumentsStr += toolCallDelta.function.arguments;

    // Try to parse when we might have complete JSON
    try {
      toolCall.arguments = JSON.parse(toolCall.argumentsStr);
      toolCall.startNotified = true;
    } catch {
      // JSON not complete yet, continue
    }
  }
}

// Helper function to record telemetry
export function recordStreamTelemetry(options: {
  requestStartTime: number;
  responseEndTime: number;
  inputTokens: number;
  outputTokens: number;
  model: any;
  tools?: any[];
}): number {
  const {
    requestStartTime,
    responseEndTime,
    inputTokens,
    outputTokens,
    model,
    tools,
  } = options;
  const totalDuration = responseEndTime - requestStartTime;
  const cost = calculateTokenCost(inputTokens, outputTokens, model.model);

  telemetryService.recordTokenUsage(inputTokens, "input", model.model);
  telemetryService.recordTokenUsage(outputTokens, "output", model.model);
  telemetryService.recordCost(cost, model.model);

  telemetryService.recordResponseTime(
    totalDuration,
    model.model,
    "total_response_time",
    (tools?.length || 0) > 0,
  );

  telemetryService.logApiRequest({
    model: model.model,
    durationMs: totalDuration,
    success: true,
    inputTokens,
    outputTokens,
    costUsd: cost,
  });

  return cost;
}

/**
 * Processes tool calls by validating and preprocessing them
 * @param toolCalls - The raw tool calls from the LLM
 * @param callbacks - Optional callbacks for notifying of events
 * @returns - Preprocessed tool calls that are ready for execution
 */
export async function preprocessStreamedToolCalls(
  toolCalls: ToolCall[],
  callbacks?: StreamCallbacks,
): Promise<{
  preprocessedCalls: PreprocessedToolCall[];
  errorChatEntries: ChatCompletionToolMessageParam[];
}> {
  const preprocessedCalls: PreprocessedToolCall[] = [];
  const errorChatEntries: ChatCompletionToolMessageParam[] = [];

  // Get all available tools
  const availableTools: Tool[] = await getAvailableTools();

  // Process each tool call
  for (const toolCall of toolCalls) {
    const startTime = Date.now();
    try {
      const tool = availableTools.find((t) => t.name === toolCall.name);
      if (!tool) {
        throw new Error(`Tool ${toolCall.name} not found`);
      }

      validateToolCallArgsPresent(toolCall, tool);

      const preprocessedCall: PreprocessedToolCall = {
        ...toolCall,
        tool,
      };

      if (tool.preprocess) {
        logger.debug("Preprocessing tool call args", {
          name: toolCall.name,
          arguments: toolCall.arguments,
        });
        const preprocessed = await tool.preprocess(toolCall.arguments);
        preprocessedCall.preprocessResult = preprocessed;
      }

      preprocessedCalls.push(preprocessedCall);
    } catch (error) {
      // Notify the UI about the tool start, even though it failed
      callbacks?.onToolStart?.(toolCall.name, toolCall.arguments);

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("Invalid tool call", {
        name: toolCall.name,
        error: errorMessage,
      });

      const duration = Date.now() - startTime;
      telemetryService.logToolResult({
        toolName: toolCall.name,
        success: false,
        durationMs: duration,
        error: errorMessage,
      });

      // Add error to chat history
      errorChatEntries.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: errorMessage,
      });

      // Notify about the error
      callbacks?.onToolError?.(errorMessage, toolCall.name);
    }
  }

  return { preprocessedCalls, errorChatEntries };
}

/**
 * Executes preprocessed tool calls, handling permissions and results
 * @param preprocessedCalls - The preprocessed tool calls ready for execution
 * @param callbacks - Optional callbacks for notifying of events
 * @returns - Chat history entries with tool results
 */
export async function executeStreamedToolCalls(
  preprocessedCalls: PreprocessedToolCall[],
  callbacks?: StreamCallbacks,
  isHeadless?: boolean,
): Promise<{
  hasRejection: boolean;
  chatHistoryEntries: ChatCompletionToolMessageParam[];
}> {
  const chatHistoryEntries: ChatCompletionToolMessageParam[] = [];
  let hasRejection = false;

  // Execute each preprocessed tool call
  for (const toolCall of preprocessedCalls) {
    if (hasRejection) {
      const cancelledMessage = `Cancelled due to previous tool rejection`;
      chatHistoryEntries.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: cancelledMessage,
      });

      callbacks?.onToolResult?.(cancelledMessage, toolCall.name, "canceled");
      continue;
    }

    // Handle remaining tool calls in this batch to maintain chat history consistency
    try {
      logger.debug("Checking tool permissions", {
        name: toolCall.name,
        arguments: toolCall.arguments,
      });

      // Notify tool start - before permission check
      // This ensures the UI shows the tool call even if it's rejected
      callbacks?.onToolStart?.(toolCall.name, toolCall.arguments);

      // Check tool permissions using helper
      const approved = await checkToolPermissionApproval(
        toolCall,
        callbacks,
        isHeadless,
      );

      if (!approved) {
        handlePermissionDenied(toolCall, chatHistoryEntries, callbacks);
        hasRejection = true;
        continue;
      }

      logger.debug("Executing tool", {
        name: toolCall.name,
        arguments: toolCall.arguments,
      });

      const toolResult = await executeToolCall(toolCall);

      chatHistoryEntries.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: toolResult,
      });

      callbacks?.onToolResult?.(toolResult, toolCall.name, "done");
    } catch (error) {
      const errorMessage = `Error executing tool ${toolCall.name}: ${
        error instanceof Error ? error.message : String(error)
      }`;

      logger.error("Tool execution failed", {
        name: toolCall.name,
        error: errorMessage,
      });

      chatHistoryEntries.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: errorMessage,
      });

      callbacks?.onToolError?.(errorMessage, toolCall.name);
    }
  }

  return {
    hasRejection,
    chatHistoryEntries,
  };
}
