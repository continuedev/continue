// Helper functions extracted from streamChatResponse.ts to reduce file size

import { ContinueError, ContinueErrorReason } from "core/util/errors.js";
import { ChatCompletionToolMessageParam } from "openai/resources/chat/completions.mjs";

import { checkToolPermission } from "../permissions/permissionChecker.js";
import { toolPermissionManager } from "../permissions/permissionManager.js";
import { ToolCallRequest } from "../permissions/types.js";
import { services } from "../services/index.js";
import { posthogService } from "../telemetry/posthogService.js";
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
  reason: "user" | "policy" = "user",
): void {
  const deniedMessage =
    reason === "policy"
      ? `Command blocked by security policy`
      : `Permission denied by user`;

  logger.info("Tool call denied", {
    name: toolCall.name,
    arguments: toolCall.arguments,
    reason,
  });

  chatHistoryEntries.push({
    role: "tool",
    tool_call_id: toolCall.id,
    content: deniedMessage,
  });

  callbacks?.onToolResult?.(deniedMessage, toolCall.name, "canceled");
  logger.debug(`Tool call rejected (${reason}) - stopping stream`);
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

  // Use graceful exit to flush telemetry even in headless denial
  // Note: We purposely trigger an async exit without awaiting in this sync path
  import("../util/exit.js").then(({ gracefulExit }) => gracefulExit(1));
  // Throw to satisfy the never return type; process will exit shortly
  throw new Error("Exiting due to headless permission requirement");
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
): Promise<{ approved: boolean; denialReason?: "user" | "policy" }> {
  const permissionCheck = checkToolPermission(toolCall);

  if (permissionCheck.permission === "allow") {
    return { approved: true };
  } else if (permissionCheck.permission === "ask") {
    if (isHeadless) {
      handleHeadlessPermission(toolCall);
    }
    const userApproved = await requestUserPermission(toolCall, callbacks);
    return userApproved
      ? { approved: true }
      : { approved: false, denialReason: "user" };
  } else if (permissionCheck.permission === "exclude") {
    // Tool blocked by security policy
    return { approved: false, denialReason: "policy" };
  }

  return { approved: false, denialReason: "policy" };
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

  // Mirror core metrics to PostHog for product analytics
  try {
    posthogService.capture("apiRequest", {
      model: model.model,
      durationMs: totalDuration,
      inputTokens,
      outputTokens,
      costUsd: cost,
    });
  } catch {}

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

      const errorReason =
        error instanceof ContinueError
          ? error.reason
          : ContinueErrorReason.Unknown;

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
        errorReason,
        // modelName, TODO
      });
      void posthogService.capture("tool_call_outcome", {
        succeeded: false,
        toolName: toolCall.name,
        errorReason,
        duration_ms: duration,
        // model: options.modelName, TODO
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
  // Strategy: queue permissions (preserve order), then run approved tools in parallel.
  // If any permission is rejected, cancel the remaining tools in this batch.

  type IndexedCall = { index: number; call: PreprocessedToolCall };
  const indexedCalls: IndexedCall[] = preprocessedCalls.map((call, index) => ({
    index,
    call,
  }));

  const entriesByIndex = new Map<number, ChatCompletionToolMessageParam>();
  const execPromises: Promise<void>[] = [];

  let hasRejection = false;

  // Permission phase (sequential)
  for (const { index, call } of indexedCalls) {
    // Do not cancel subsequent tools after a rejection; handle each independently

    try {
      logger.debug("Checking tool permissions", {
        name: call.name,
        arguments: call.arguments,
      });

      // Notify tool start before permission check to display in UI fallbacks
      callbacks?.onToolStart?.(call.name, call.arguments);

      // Check tool permissions using helper
      const permissionResult = await checkToolPermissionApproval(
        call,
        callbacks,
        isHeadless,
      );

      if (!permissionResult.approved) {
        // Permission denied: record and mark rejection
        const denialReason = permissionResult.denialReason || "user";
        const deniedMessage =
          denialReason === "policy"
            ? `Command blocked by security policy`
            : `Permission denied by user`;

        const deniedEntry: ChatCompletionToolMessageParam = {
          role: "tool",
          tool_call_id: call.id,
          content: deniedMessage,
        };
        entriesByIndex.set(index, deniedEntry);
        callbacks?.onToolResult?.(
          String(deniedEntry.content),
          call.name,
          "canceled",
        );
        // Immediate service update for UI feedback
        try {
          services.chatHistory.addToolResult(
            call.id,
            String(deniedEntry.content),
            "canceled",
          );
        } catch {}
        hasRejection = true;
        // Remaining items will be auto-cancelled in subsequent iterations
        continue;
      }

      // Immediately mark as calling for instant UI feedback
      try {
        services.chatHistory.updateToolStatus(call.id, "calling");
      } catch {}

      // Start execution immediately for approved calls
      execPromises.push(
        (async () => {
          try {
            logger.debug("Executing tool", {
              name: call.name,
              arguments: call.arguments,
            });
            const toolResult = await executeToolCall(call);
            const entry: ChatCompletionToolMessageParam = {
              role: "tool",
              tool_call_id: call.id,
              content: toolResult,
            };
            entriesByIndex.set(index, entry);
            callbacks?.onToolResult?.(toolResult, call.name, "done");
            // Immediate service update for UI feedback
            try {
              services.chatHistory.addToolResult(
                call.id,
                String(toolResult),
                "done",
              );
            } catch {}
          } catch (error) {
            const errorMessage = `Error executing tool ${call.name}: ${
              error instanceof Error ? error.message : String(error)
            }`;
            logger.error("Tool execution failed", {
              name: call.name,
              error: errorMessage,
            });
            entriesByIndex.set(index, {
              role: "tool",
              tool_call_id: call.id,
              content: errorMessage,
            });
            callbacks?.onToolError?.(errorMessage, call.name);
            // Immediate service update for UI feedback
            try {
              services.chatHistory.addToolResult(
                call.id,
                errorMessage as string,
                "errored",
              );
            } catch {}
          }
        })(),
      );
    } catch (error) {
      const errorMessage = `Error checking permissions for ${call.name}: ${
        error instanceof Error ? error.message : String(error)
      }`;
      logger.error("Permission check failed", {
        name: call.name,
        error: errorMessage,
      });
      entriesByIndex.set(index, {
        role: "tool",
        tool_call_id: call.id,
        content: errorMessage,
      });
      callbacks?.onToolError?.(errorMessage, call.name);
      // Treat permission errors like execution errors but do not stop the batch
      try {
        services.chatHistory.addToolResult(
          call.id,
          errorMessage as string,
          "errored",
        );
      } catch {}
    }
  }

  await Promise.all(execPromises);

  // Assemble final entries in original order
  const chatHistoryEntries: ChatCompletionToolMessageParam[] = preprocessedCalls
    .map((_, index) => entriesByIndex.get(index))
    .filter((e): e is ChatCompletionToolMessageParam => !!e);

  return {
    hasRejection,
    chatHistoryEntries,
  };
}
