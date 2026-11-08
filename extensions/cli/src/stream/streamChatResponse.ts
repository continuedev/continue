/* eslint-disable max-lines */
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
import { getRequestBodyHints } from "../contextManagement.js";
import { consumeLoopTurnEnd, loopRequestHistory } from "../loop/loopSession.js";
import { services } from "../services/index.js";
import { telemetryService } from "../telemetry/telemetryService.js";
import { applyChatCompletionToolOverrides } from "../tools/applyToolOverrides.js";
import { ToolCall } from "../tools/index.js";
import {
  chatCompletionStreamWithBackoff,
  isContextLengthError,
  withExponentialBackoff,
} from "../util/exponentialBackoff.js";
import { logger } from "../util/logger.js";
import { validateContextLength } from "../util/tokenizer.js";

import { getRequestTools, handleToolCalls } from "./handleToolCalls.js";
import { injectSteeringMessage } from "./steering.js";
import {
  handleAutoContinuation,
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
import { taskListBlockForRequest } from "./taskListBlock.js";

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
  isCompacting?: boolean; // also: compaction gets no Loop mode plan block
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
  usage?: any;
}> {
  const {
    model,
    llmApi,
    abortController,
    callbacks,
    isHeadless,
    tools,
    systemMessage,
    isCompacting = false,
  } = options;

  // The request carries one system message, the current `systemMessage`.
  // A system item in the history is left out: `cn serve` stores the startup
  // system message there, fixed before any mode switch, and the TUI stores
  // slash command output and compaction notices there for display only.
  let chatHistory = options.chatHistory.filter(
    (item) => item.message.role !== "system",
  );

  // The session's task list, sent last when the TaskList tool is offered.
  const taskListBlock = taskListBlockForRequest(tools, isCompacting);

  // Safety buffer to account for tokenization estimation errors
  const SAFETY_BUFFER = 100;

  // Validate context length INCLUDING system message and tools
  // The task list block is counted with the system message: it is sent with
  // every request and is never pruned.
  const fixedText = taskListBlock
    ? `${systemMessage}\n${taskListBlock}`
    : systemMessage;
  let validation = validateContextLength({
    chatHistory,
    model,
    safetyBuffer: SAFETY_BUFFER,
    systemMessage: fixedText,
    tools,
  });

  // Prune last messages until valid (excluding system message)
  while (chatHistory.length > 1 && !validation.isValid) {
    const prunedChatHistory = pruneLastMessage(chatHistory);
    if (prunedChatHistory.length === chatHistory.length) {
      break;
    }
    chatHistory = prunedChatHistory;

    // Re-validate with system message and tools
    validation = validateContextLength({
      chatHistory,
      model,
      safetyBuffer: SAFETY_BUFFER,
      systemMessage: fixedText,
      tools,
    });
  }

  if (!validation.isValid) {
    throw new Error(`Context length validation failed: ${validation.error}`);
  }

  // Create OpenAI format history with validated system message
  const openaiChatHistory = convertFromUnifiedHistoryWithSystemMessage(
    chatHistory,
    systemMessage,
  ) as ChatCompletionMessageParam[];
  // Last, after the history: a change to the list then changes only the tail
  // of the request, and Bedrock puts its cache point before it.
  if (taskListBlock) {
    openaiChatHistory.push({ role: "user", content: taskListBlock });
  }
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
        // A compaction summary is never continued, so it is a one-shot request
        ...getRequestBodyHints(
          model,
          isCompacting ? "oneShot" : "conversation",
        ),
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
  let fullUsage: any = null;
  // Bedrock's request ID (its invocation log and the bill use it) or the
  // provider's response ID; empty when the provider sends none.
  let requestId: string | undefined;

  try {
    const streamWithBackoff = withExponentialBackoff(
      streamFactory,
      abortController.signal,
    );

    let chunkCount = 0;
    for await (const chunk of streamWithBackoff) {
      chunkCount++;

      logger.debug("Received chunk", { chunkCount, chunk });

      if (!requestId && chunk.id) requestId = chunk.id;

      // Track token usage if available
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens || 0;
        outputTokens = chunk.usage.completion_tokens || 0;
        fullUsage = chunk.usage; // Capture full usage including cache details
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
      fullUsage,
    });
    const totalDuration = responseEndTime - requestStartTime;

    // Enhance fullUsage with model and cost for saving to session
    if (fullUsage) {
      fullUsage.model = model.model;
      fullUsage.cost_cents = Math.round(cost * 100); // Convert dollars to cents
    }

    logger.debug("Stream complete", {
      requestId,
      chunkCount,
      responseLength: aiResponse.length,
      toolCallsCount: toolCallsMap.size,
      inputTokens,
      outputTokens,
      cacheReadTokens: fullUsage?.prompt_tokens_details?.cache_read_tokens,
      cacheWriteTokens: fullUsage?.prompt_tokens_details?.cache_write_tokens,
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

    if (error.name === "AbortError" || abortController?.signal.aborted) {
      logger.debug("Stream aborted by user");
      return {
        content: aiResponse,
        finalContent: aiResponse,
        toolCalls: [],
        shouldContinue: false,
        usage: fullUsage,
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
    usage: fullUsage,
  };
}

export interface StreamChatResponseOptions {
  /**
   * Whether auto-compaction saves the compacted history to the current
   * session. False for sub-agents, whose child history is not the session's.
   */
  persistSession?: boolean;
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
  options: StreamChatResponseOptions = {},
) {
  const { persistSession = true } = options;
  logger.debug("streamChatResponse called", {
    model,
    historyLength: chatHistory.length,
    hasCallbacks: !!callbacks,
  });

  const isHeadless = services.toolPermissions.isHeadless();

  let fullResponse = "";
  let finalResponse = "";
  let compactionOccurredThisTurn = false; // Track if compaction happened during this conversation turn
  let autoContinuedLastIteration = false; // Whether the previous iteration only sent our own "continue"

  while (true) {
    // If ChatHistoryService is available, refresh local chatHistory view
    chatHistory = refreshChatHistoryFromService(chatHistory, isCompacting);
    logger.debug("Starting conversation iteration");

    // Get system message once per iteration (can change based on tool permissions mode)
    const systemMessage = await services.systemMessage.getSystemMessage(
      services.toolPermissions.getState().currentMode,
    );

    // Recompute tools on each iteration to handle mode changes during streaming
    const rawTools = await getRequestTools(isHeadless);
    const tools = applyChatCompletionToolOverrides(
      rawTools,
      model.chatOptions?.toolOverrides,
    );

    // Pre-API auto-compaction checkpoint (now includes tools)
    const preCompactionResult = await handlePreApiCompaction(chatHistory, {
      model,
      llmApi,
      isCompacting,
      isHeadless,
      callbacks,
      systemMessage,
      tools,
      persistSession,
    });
    chatHistory = preCompactionResult.chatHistory;
    if (preCompactionResult.wasCompacted) {
      compactionOccurredThisTurn = true;
    }

    logger.debug("Tools prepared", {
      toolCount: tools.length,
      toolNames: tools.map((t) => t.function.name),
    });

    // Get response from LLM ("Steer now" interrupts only while it streams;
    // Loop mode sends each run without the turns before it)
    callbacks?.onModelStreaming?.(true);
    const { content, toolCalls, shouldContinue, usage } =
      await processStreamingResponse({
        isHeadless,
        chatHistory: loopRequestHistory(chatHistory, isCompacting),
        model,
        llmApi,
        abortController,
        callbacks,
        tools,
        systemMessage,
        isCompacting,
      }).finally(() => callbacks?.onModelStreaming?.(false));

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
    const shouldReturn = await handleToolCalls({
      toolCalls,
      chatHistory,
      content,
      callbacks,
      isHeadless,
      usage,
      abortSignal: abortController.signal,
    });

    if (shouldReturn) {
      return finalResponse || content || fullResponse;
    }

    // Loop mode: FinishItem (or a plan the loop asked for) ends the turn
    // with no further request; undelivered steered answers go with the next run.
    if (consumeLoopTurnEnd(isCompacting)) {
      break;
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
        tools,
        persistSession,
      },
    );
    chatHistory = postToolResult.chatHistory;
    if (postToolResult.wasCompacted) {
      compactionOccurredThisTurn = true;
    }

    // Normal auto-compaction check at the model's threshold
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
        tools,
        persistSession,
      },
    );
    chatHistory = compactionResult.chatHistory;
    if (compactionResult.wasCompacted) {
      compactionOccurredThisTurn = true;
    }

    // Tool boundary: deliver a message the person steered with, so the next
    // request already sees it. This runs after the post-tool checks so that
    // pruning an oversized tool result cannot drop the message instead.
    if (toolCalls.length > 0 && !abortController?.signal.aborted) {
      chatHistory = (await injectSteeringMessage(callbacks, chatHistory))
        .chatHistory;
    }

    // If compaction happened during this turn and we're about to stop,
    // automatically send a continuation message to keep the agent going
    const autoContinueResult = handleAutoContinuation(
      compactionOccurredThisTurn,
      shouldContinue,
      chatHistory,
      autoContinuedLastIteration,
    );
    chatHistory = autoContinueResult.chatHistory;
    const shouldAutoContinue = autoContinueResult.shouldAutoContinue;

    // Reset flag to avoid infinite continuation
    if (shouldAutoContinue) {
      compactionOccurredThisTurn = false;
    }
    autoContinuedLastIteration = shouldAutoContinue;

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
