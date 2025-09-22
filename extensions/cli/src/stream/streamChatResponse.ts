import { ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import type { ChatHistoryItem } from "core/index.js";
import { convertFromUnifiedHistoryWithSystemMessage } from "core/util/messageConversion.js";
import * as dotenv from "dotenv";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources.mjs";

import { getServiceSync, SERVICE_NAMES, services } from "../services/index.js";
import { systemMessageService } from "../services/SystemMessageService.js";
import type { ToolPermissionServiceState } from "../services/ToolPermissionService.js";
import { posthogService } from "../telemetry/posthogService.js";
import { telemetryService } from "../telemetry/telemetryService.js";
import { ToolCall } from "../tools/index.js";
import {
  chatCompletionStreamWithBackoff,
  isContextLengthError,
  withExponentialBackoff,
} from "../util/exponentialBackoff.js";
import { logger } from "../util/logger.js";
import { validateContextLength } from "../util/tokenizer.js";

import { getAllTools, handleToolCalls } from "./handleToolCalls.js";
import { handleAutoCompaction } from "./streamChatResponse.autoCompaction.js";
import {
  processChunkContent,
  processToolCallDelta,
  recordStreamTelemetry,
  trackFirstTokenTime,
} from "./streamChatResponse.helpers.js";
import {
  getDefaultCompletionOptions,
  StreamCallbacks,
} from "./streamChatResponse.types.js";

dotenv.config();

function updateFinalResponse(
  content: string,
  shouldContinue: boolean,
  isHeadless: boolean,
  currentFinalResponse: string,
): string {
  if (!shouldContinue) {
    return content;
  } else if (isHeadless && content) {
    return content;
  }
  return currentFinalResponse;
}

function handleContentDisplay(
  content: string,
  callbacks: StreamCallbacks | undefined,
  isHeadless: boolean,
): void {
  // Add newline after content if needed
  if (!callbacks?.onContent && !isHeadless && content) {
    logger.info("");
  }

  // Notify content complete
  if (content && callbacks?.onContentComplete) {
    callbacks.onContentComplete(content);
  }
}

// Helper function to process a single chunk
interface ProcessChunkOptions {
  chunk: any;
  aiResponse: string;
  toolCallsMap: Map<string, ToolCall>;
  indexToIdMap: Map<number, string>;
  callbacks?: StreamCallbacks;
  isHeadless?: boolean;
}

function processChunk(options: ProcessChunkOptions): {
  aiResponse: string;
  shouldContinue: boolean;
} {
  const {
    chunk,
    aiResponse,
    toolCallsMap,
    indexToIdMap,
    callbacks,
    isHeadless,
  } = options;
  // Safety check: ensure chunk has the expected structure
  if (!chunk.choices || !chunk.choices[0]) {
    return { aiResponse, shouldContinue: true };
  }

  const choice = chunk.choices[0];
  if (!choice.delta) {
    return { aiResponse, shouldContinue: true };
  }

  let updatedResponse = aiResponse;

  // Handle content streaming
  if (choice.delta.content) {
    updatedResponse = processChunkContent(
      choice.delta.content,
      aiResponse,
      callbacks,
      isHeadless,
    );
  }

  // Handle tool calls
  if (choice.delta.tool_calls) {
    for (const toolCallDelta of choice.delta.tool_calls) {
      processToolCallDelta(toolCallDelta, toolCallsMap, indexToIdMap);
    }
  }

  return { aiResponse: updatedResponse, shouldContinue: true };
}

interface ProcessStreamingResponseOptions {
  chatHistory: ChatHistoryItem[];
  model: ModelConfig;
  llmApi: BaseLlmApi;
  abortController: AbortController;
  callbacks?: StreamCallbacks;
  isHeadless?: boolean;
  tools?: ChatCompletionTool[];
}

// Process a single streaming response and return whether we need to continue
export async function processStreamingResponse(
  options: ProcessStreamingResponseOptions,
): Promise<{
  content: string;
  finalContent: string; // Added field for final content only
  toolCalls: ToolCall[];
  shouldContinue: boolean;
}> {
  const {
    chatHistory,
    model,
    llmApi,
    abortController,
    callbacks,
    isHeadless,
    tools,
  } = options;

  // Validate context length before making the request
  const validation = validateContextLength(chatHistory, model);
  if (!validation.isValid) {
    throw new Error(`Context length validation failed: ${validation.error}`);
  }

  // Get fresh system message and inject it
  const systemMessage = await systemMessageService.getSystemMessage();
  const openaiChatHistory = convertFromUnifiedHistoryWithSystemMessage(
    chatHistory,
    systemMessage,
  ) as ChatCompletionMessageParam[];
  const requestStartTime = Date.now();

  const streamFactory = async (retryAbortSignal: AbortSignal) => {
    logger.debug("Creating chat completion stream", {
      model,
      messageCount: chatHistory.length,
      toolCount: tools?.length || 0,
    });
    return await chatCompletionStreamWithBackoff(
      llmApi,
      {
        model: model.model,
        messages: openaiChatHistory,
        stream: true,
        tools,
        ...getDefaultCompletionOptions(model.defaultCompletionOptions),
      },
      retryAbortSignal,
    );
  };

  let aiResponse = "";
  let finalContent = "";
  const toolCallsMap = new Map<string, ToolCall>();
  const indexToIdMap = new Map<number, string>(); // Track index to ID mapping
  let firstTokenTime: number | null = null;
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const streamWithBackoff = withExponentialBackoff(
      streamFactory,
      abortController.signal,
    );

    let chunkCount = 0;
    for await (const chunk of streamWithBackoff) {
      chunkCount++;

      logger.debug("Received chunk", { chunkCount, chunk });

      // Track token usage if available
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens || 0;
        outputTokens = chunk.usage.completion_tokens || 0;
      }

      // Check if we should abort
      if (abortController?.signal.aborted) {
        logger.debug("Stream aborted");
        break;
      }

      // Track first token time
      firstTokenTime = trackFirstTokenTime(
        firstTokenTime,
        chunk,
        requestStartTime,
        model,
        tools,
      );

      const result = processChunk({
        chunk,
        aiResponse,
        toolCallsMap,
        indexToIdMap,
        callbacks,
        isHeadless,
      });
      aiResponse = result.aiResponse;
      if (!result.shouldContinue) break;
    }

    const responseEndTime = Date.now();
    const cost = recordStreamTelemetry({
      requestStartTime,
      responseEndTime,
      inputTokens,
      outputTokens,
      model,
      tools,
    });
    const totalDuration = responseEndTime - requestStartTime;

    logger.debug("Stream complete", {
      chunkCount,
      responseLength: aiResponse.length,
      toolCallsCount: toolCallsMap.size,
      inputTokens,
      outputTokens,
      cost,
      duration: totalDuration,
    });
  } catch (error: any) {
    const errorDuration = Date.now() - requestStartTime;

    // Log failed API request
    telemetryService.logApiRequest({
      model: model.model,
      durationMs: errorDuration,
      success: false,
      error: error.message || String(error),
    });

    try {
      posthogService.capture("apiRequest", {
        model: model.model,
        durationMs: errorDuration,
        success: false,
        error: error.message || String(error),
      });
    } catch {}

    if (error.name === "AbortError" || abortController?.signal.aborted) {
      logger.debug("Stream aborted by user");
      return {
        content: aiResponse,
        finalContent: aiResponse,
        toolCalls: [],
        shouldContinue: false,
      };
    }

    // Handle context length errors with helpful message
    if (isContextLengthError(error)) {
      logger.debug(`Context length exceeded: ${error}`);
      throw new Error(`Context length exceeded: ${error}`);
    }

    throw error;
  }

  const toolCalls = Array.from(toolCallsMap.values());

  // Validate tool calls have complete arguments
  const validToolCalls = toolCalls.filter((tc) => {
    if (!tc.arguments || !tc.name) {
      logger.error("Incomplete tool call", {
        id: tc.id,
        name: tc.name,
        hasArguments: !!tc.arguments,
        argumentsStr: tc.argumentsStr,
      });
      return false;
    }
    return true;
  });

  // Always preserve the content - it should be displayed regardless of tool calls
  finalContent = aiResponse;

  return {
    content: aiResponse,
    finalContent: finalContent,
    toolCalls: validToolCalls,
    shouldContinue: validToolCalls.length > 0,
  };
}

// Main function that handles the conversation loop
// eslint-disable-next-line complexity
export async function streamChatResponse(
  chatHistory: ChatHistoryItem[],
  model: ModelConfig,
  llmApi: BaseLlmApi,
  abortController: AbortController,
  callbacks?: StreamCallbacks,
) {
  logger.debug("streamChatResponse called", {
    model,
    historyLength: chatHistory.length,
    hasCallbacks: !!callbacks,
  });

  const serviceResult = getServiceSync<ToolPermissionServiceState>(
    SERVICE_NAMES.TOOL_PERMISSIONS,
  );
  const isHeadless = serviceResult.value?.isHeadless ?? false;

  let fullResponse = "";
  let finalResponse = "";

  while (true) {
    // If ChatHistoryService is available, refresh local chatHistory view
    const chatHistorySvc = services.chatHistory;
    if (
      typeof chatHistorySvc?.isReady === "function" &&
      chatHistorySvc.isReady()
    ) {
      try {
        chatHistory = chatHistorySvc.getHistory();
      } catch {}
    }
    logger.debug("Starting conversation iteration");

    // Pre-API auto-compaction checkpoint
    const { wasCompacted: preCompacted, chatHistory: preCompactHistory } =
      await handleAutoCompaction(chatHistory, model, llmApi, {
        isHeadless,
        callbacks: {
          onSystemMessage: callbacks?.onSystemMessage,
          onContent: callbacks?.onContent,
        },
      });

    if (preCompacted) {
      logger.debug("Pre-API compaction occurred, updating chat history");
      // Update chat history after pre-compaction
      const chatHistorySvc2 = services.chatHistory;
      if (
        typeof chatHistorySvc2?.isReady === "function" &&
        chatHistorySvc2.isReady()
      ) {
        chatHistorySvc2.setHistory(preCompactHistory);
        chatHistory = chatHistorySvc2.getHistory();
      } else {
        chatHistory = [...preCompactHistory];
      }
    }

    // Recompute tools on each iteration to handle mode changes during streaming
    const tools = await getAllTools();

    logger.debug("Tools prepared", {
      toolCount: tools.length,
      toolNames: tools.map((t) => t.function.name),
    });

    // Get response from LLM
    const { content, toolCalls, shouldContinue } =
      await processStreamingResponse({
        chatHistory,
        model,
        llmApi,
        abortController,
        callbacks,
        isHeadless,
        tools,
      });

    if (abortController?.signal.aborted) {
      return finalResponse || content || fullResponse;
    }

    fullResponse += content;

    // Update final response based on mode
    finalResponse = updateFinalResponse(
      content,
      shouldContinue,
      isHeadless,
      finalResponse,
    );

    // Handle content display
    handleContentDisplay(content, callbacks, isHeadless);

    // Handle tool calls and check for early return. This updates history via ChatHistoryService.
    const shouldReturn = await handleToolCalls(
      toolCalls,
      chatHistory,
      content,
      callbacks,
      isHeadless,
    );

    if (shouldReturn) {
      return finalResponse || content || fullResponse;
    }

    // Check for auto-compaction after tool execution
    if (shouldContinue) {
      const { wasCompacted, chatHistory: updatedChatHistory } =
        await handleAutoCompaction(chatHistory, model, llmApi, {
          isHeadless,
          callbacks: {
            onSystemMessage: callbacks?.onSystemMessage,
            onContent: callbacks?.onContent,
          },
        });

      // Only update chat history if compaction actually occurred
      if (wasCompacted) {
        // Always prefer service; local copy is for temporary reads only
        const chatHistorySvc2 = services.chatHistory;
        if (
          typeof chatHistorySvc2?.isReady === "function" &&
          chatHistorySvc2.isReady()
        ) {
          chatHistorySvc2.setHistory(updatedChatHistory);
          chatHistory = chatHistorySvc2.getHistory();
        } else {
          // Fallback only when service is unavailable
          chatHistory = [...updatedChatHistory];
        }
      }
    }

    // Check if we should continue
    if (!shouldContinue) {
      break;
    }
  }

  logger.debug("streamChatResponse complete", {
    totalResponseLength: fullResponse.length,
    totalMessages: chatHistory.length,
  });

  // For headless mode, we return only the final response
  // Otherwise, return the full response
  return isHeadless ? finalResponse : fullResponse;
}
export { getAllTools };
