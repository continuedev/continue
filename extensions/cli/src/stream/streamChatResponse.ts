import { ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import type { ChatHistoryItem } from "core/index.js";
import { convertFromUnifiedHistoryWithSystemMessage } from "core/util/messageConversion.js";
import * as dotenv from "dotenv";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources.mjs";

import { pruneLastMessage } from "../compaction.js";
import { services } from "../services/index.js";
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

import { getRequestTools, handleToolCalls } from "./handleToolCalls.js";
import {
  handleNormalAutoCompaction,
  handlePostToolValidation,
  handlePreApiCompaction,
} from "./streamChatResponse.compactionHelpers.js";
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

// Helper function to refresh chat history from service
function refreshChatHistoryFromService(
  chatHistory: ChatHistoryItem[],
  isCompacting: boolean,
): ChatHistoryItem[] {
  const chatHistorySvc = services.chatHistory;
  if (
    typeof chatHistorySvc?.isReady === "function" &&
    chatHistorySvc.isReady()
  ) {
    try {
      // use chat history from params when isCompacting is true
      // otherwise use the full history
      if (!isCompacting) {
        return chatHistorySvc.getHistory();
      }
    } catch {}
  }
  return chatHistory;
}

// Helper function to handle auto-continuation after compaction
function handleAutoContinuation(
  compactionOccurred: boolean,
  shouldContinue: boolean,
  chatHistory: ChatHistoryItem[],
): { shouldAutoContinue: boolean; chatHistory: ChatHistoryItem[] } {
  if (!compactionOccurred || shouldContinue) {
    return { shouldAutoContinue: false, chatHistory };
  }

  logger.debug(
    "Auto-compaction occurred during this turn - automatically continuing session",
  );

  // Add a continuation message to the history
  const chatHistorySvc = services.chatHistory;
  if (
    typeof chatHistorySvc?.isReady === "function" &&
    chatHistorySvc.isReady()
  ) {
    chatHistorySvc.addUserMessage("continue");
    chatHistory = chatHistorySvc.getHistory();
  } else {
    chatHistory.push({
      message: {
        role: "user",
        content: "continue",
      },
      contextItems: [],
    });
  }

  logger.debug("Added continuation message after compaction");
  return { shouldAutoContinue: true, chatHistory };
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
  systemMessage: string;
}

// Process a single streaming response and return whether we need to continue
// eslint-disable-next-line max-statements
export async function processStreamingResponse(
  options: ProcessStreamingResponseOptions,
): Promise<{
  content: string;
  finalContent: string; // Added field for final content only
  toolCalls: ToolCall[];
  shouldContinue: boolean;
}> {
  const {
    model,
    llmApi,
    abortController,
    callbacks,
    isHeadless,
    tools,
    systemMessage,
  } = options;

  let chatHistory = options.chatHistory;

  // Create temporary system message item for validation
  const systemMessageItem: ChatHistoryItem = {
    message: {
      role: "system",
      content: systemMessage,
    },
    contextItems: [],
  };

  // Safety buffer to account for tokenization estimation errors
  const SAFETY_BUFFER = 100;

  // Validate context length INCLUDING system message
  let historyWithSystem = [systemMessageItem, ...chatHistory];
  let validation = validateContextLength(
    historyWithSystem,
    model,
    SAFETY_BUFFER,
  );

  // Prune last messages until valid (excluding system message)
  while (chatHistory.length > 1 && !validation.isValid) {
    const prunedChatHistory = pruneLastMessage(chatHistory);
    if (prunedChatHistory.length === chatHistory.length) {
      break;
    }
    chatHistory = prunedChatHistory;

    // Re-validate with system message
    historyWithSystem = [systemMessageItem, ...chatHistory];
    validation = validateContextLength(historyWithSystem, model, SAFETY_BUFFER);
  }

  if (!validation.isValid) {
    throw new Error(`Context length validation failed: ${validation.error}`);
  }

  // Create OpenAI format history with validated system message
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
    if (!tc.name) {
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
// eslint-disable-next-line max-params
export async function streamChatResponse(
  chatHistory: ChatHistoryItem[],
  model: ModelConfig,
  llmApi: BaseLlmApi,
  abortController: AbortController,
  callbacks?: StreamCallbacks,
  isCompacting = false,
) {
  logger.debug("streamChatResponse called", {
    model,
    historyLength: chatHistory.length,
    hasCallbacks: !!callbacks,
  });

  const isHeadless = services.toolPermissions.isHeadless();

  let fullResponse = "";
  let finalResponse = "";
  let compactionOccurredThisTurn = false; // Track if compaction happened during this conversation turn

  while (true) {
    // If ChatHistoryService is available, refresh local chatHistory view
    chatHistory = refreshChatHistoryFromService(chatHistory, isCompacting);
    logger.debug("Starting conversation iteration");

    logger.debug("debug1 streamChatResponse history", { chatHistory });

    // Get system message once per iteration (can change based on tool permissions mode)
    const systemMessage = await services.systemMessage.getSystemMessage(
      services.toolPermissions.getState().currentMode,
    );

    // Pre-API auto-compaction checkpoint
    const preCompactionResult = await handlePreApiCompaction(chatHistory, {
      model,
      llmApi,
      isCompacting,
      isHeadless,
      callbacks,
      systemMessage,
    });
    chatHistory = preCompactionResult.chatHistory;
    if (preCompactionResult.wasCompacted) {
      compactionOccurredThisTurn = true;
    }

    // Recompute tools on each iteration to handle mode changes during streaming
    const tools = await getRequestTools(isHeadless);

    logger.debug("Tools prepared", {
      toolCount: tools.length,
      toolNames: tools.map((t) => t.function.name),
    });

    // Get response from LLM
    const { content, toolCalls, shouldContinue } =
      await processStreamingResponse({
        isHeadless,
        chatHistory,
        model,
        llmApi,
        abortController,
        callbacks,
        tools,
        systemMessage,
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

    // After tool execution, validate that we haven't exceeded context limit
    const postToolResult = await handlePostToolValidation(
      toolCalls,
      chatHistory,
      {
        model,
        llmApi,
        isCompacting,
        isHeadless,
        callbacks,
        systemMessage,
      },
    );
    chatHistory = postToolResult.chatHistory;
    if (postToolResult.wasCompacted) {
      compactionOccurredThisTurn = true;
    }

    // Normal auto-compaction check at 80% threshold
    const compactionResult = await handleNormalAutoCompaction(
      chatHistory,
      shouldContinue,
      {
        model,
        llmApi,
        isCompacting,
        isHeadless,
        callbacks,
        systemMessage,
      },
    );
    chatHistory = compactionResult.chatHistory;
    if (compactionResult.wasCompacted) {
      compactionOccurredThisTurn = true;
    }

    // If compaction happened during this turn and we're about to stop,
    // automatically send a continuation message to keep the agent going
    const autoContinueResult = handleAutoContinuation(
      compactionOccurredThisTurn,
      shouldContinue,
      chatHistory,
    );
    chatHistory = autoContinueResult.chatHistory;
    const shouldAutoContinue = autoContinueResult.shouldAutoContinue;

    // Reset flag to avoid infinite continuation
    if (shouldAutoContinue) {
      compactionOccurredThisTurn = false;
    }

    // Check if we should continue (skip break if auto-continuing after compaction)
    if (!shouldContinue && !shouldAutoContinue) {
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
