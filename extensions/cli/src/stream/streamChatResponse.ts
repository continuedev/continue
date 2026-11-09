/* eslint-disable max-lines */
import { ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import type { ChatHistoryItem } from "core/index.js";
import { convertFromUnifiedHistoryWithSystemMessage } from "core/util/messageConversion.js";
import {
  ACT_TURN_NUDGE,
  announcesNextStep,
  TURN_NUDGE_LIMIT,
  TURN_NUDGE_TOTAL,
} from "core/util/turnEnd.js";
import * as dotenv from "dotenv";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources.mjs";

import { pruneLastMessage } from "../compaction.js";
import { getRequestBodyHints } from "../contextManagement.js";
import { withEnvironmentBlock } from "../environmentContext.js";
import {
  consumeLoopTurnEnd,
  loopRequestHistory,
  loopRunGoing,
} from "../loop/loopSession.js";
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
import {
  recordTruncatedReply,
  TRUNCATED_REPLY_MESSAGE,
} from "../util/replyTally.js";
import { dumpRequest } from "../util/requestDump.js";
import { validateContextLength } from "../util/tokenizer.js";

import { getRequestTools, handleToolCalls } from "./handleToolCalls.js";
import { resetRefusalCount } from "./refusalCap.js";
import { resetRepeatGuard } from "./repeatGuard.js";
import { injectSteeringMessage } from "./steering.js";
import {
  handleAutoContinuation,
  handleNormalAutoCompaction,
  handlePostToolValidation,
  handlePreApiCompaction,
} from "./streamChatResponse.compactionHelpers.js";
import {
  cacheReadTokens,
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

/** Bedrock's request ID or the provider's response ID, from the first chunk that has one. */
function firstRequestId(
  current: string | undefined,
  chunk: { id?: string },
): string | undefined {
  return current ?? (chunk.id || undefined);
}

/** The provider's finish_reason of the last chunk that carried one. */
function latestFinishReason(
  current: string | undefined,
  chunk: { choices?: { finish_reason?: string | null }[] },
): string | undefined {
  return chunk.choices?.[0]?.finish_reason ?? current;
}

/**
 * A reply the output limit cut off is not a finished answer: say so to the
 * person and count it, instead of passing it off as complete.
 */
function noteTruncation(
  finishReason: string | undefined,
  facts: { requestId: string | undefined; outputTokens: number },
  callbacks: StreamCallbacks | undefined,
): void {
  if (finishReason !== "length") return;
  recordTruncatedReply();
  logger.warn("Reply cut off at the model's output limit", facts);
  callbacks?.onStatusMessage?.(TRUNCATED_REPLY_MESSAGE);
}

/** Per-turn budget for the end-of-turn nudges (core/util/turnEnd.ts). */
interface TurnNudges {
  sinceToolUse: number;
  thisTurn: number;
}

/**
 * A headless agent turn that ends by announcing its next step ("Let me
 * check...") with no tool call gets a nudge to take it; nobody else is there
 * to say "go on". A nudge that led to tool calls worked and the budget starts
 * again; one that led to another announcement did not, and the turn ends. A
 * few per turn at most. Loop runs have their own nudge in the driver, and a
 * compaction's or subagent's run is left alone. Returns the history with the
 * nudge appended, or undefined when the turn is not nudged.
 */
function nudgeAnnouncedStep(args: {
  content: string;
  shouldContinue: boolean;
  shouldAutoContinue: boolean;
  isHeadless: boolean;
  isCompacting: boolean;
  chatHistory: ChatHistoryItem[];
  nudges: TurnNudges;
}): ChatHistoryItem[] | undefined {
  const { nudges } = args;
  if (args.shouldContinue) nudges.sinceToolUse = 0;
  const eligible =
    !args.shouldContinue &&
    !args.shouldAutoContinue &&
    args.isHeadless &&
    !args.isCompacting &&
    !loopRunGoing() &&
    nudges.sinceToolUse < TURN_NUDGE_LIMIT &&
    nudges.thisTurn < TURN_NUDGE_TOTAL;
  if (!eligible || !announcesNextStep(args.content)) return undefined;
  nudges.sinceToolUse++;
  nudges.thisTurn++;
  logger.debug("Turn ended on an announced step; nudging", {
    nudgesThisTurn: nudges.thisTurn,
  });
  const svc = services.chatHistory;
  if (typeof svc?.isReady === "function" && svc.isReady()) {
    svc.addUserMessage(ACT_TURN_NUDGE);
    return svc.getHistory();
  }
  return [
    ...args.chatHistory,
    { message: { role: "user", content: ACT_TURN_NUDGE }, contextItems: [] },
  ];
}

/**
 * After a round of tool calls: the context-limit check on their results
 * (handlePostToolValidation), then the normal auto-compaction check at the
 * model's threshold. `wasCompacted` says whether either compacted.
 */
async function compactAfterTools(
  toolCalls: ToolCall[],
  chatHistory: ChatHistoryItem[],
  shouldContinue: boolean,
  ctx: Parameters<typeof handlePostToolValidation>[2],
): Promise<{ chatHistory: ChatHistoryItem[]; wasCompacted: boolean }> {
  const post = await handlePostToolValidation(toolCalls, chatHistory, ctx);
  const normal = await handleNormalAutoCompaction(
    post.chatHistory,
    shouldContinue,
    ctx,
  );
  return {
    chatHistory: normal.chatHistory,
    wasCompacted: post.wasCompacted || normal.wasCompacted,
  };
}

/** The per-turn guards start again with each turn, not with a compaction's run. */
function resetTurnGuards(isCompacting: boolean): void {
  if (isCompacting) return;
  resetRefusalCount();
  resetRepeatGuard();
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
  /** The provider's finish_reason of the last chunk that carried one. */
  finishReason?: string;
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

  // Create OpenAI format history with validated system message. The date and
  // git status go on the first user message, after the system checkpoint of
  // the prompt cache, so the system text is the same across sessions.
  const openaiChatHistory = withEnvironmentBlock(
    convertFromUnifiedHistoryWithSystemMessage(
      chatHistory,
      systemMessage,
    ) as ChatCompletionMessageParam[],
  );
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
    const body = {
      model: model.model,
      messages: openaiChatHistory,
      stream: true as const,
      tools,
      ...getDefaultCompletionOptions(model.defaultCompletionOptions),
      // A compaction summary is never continued, so it is a one-shot request
      ...getRequestBodyHints(model, isCompacting ? "oneShot" : "conversation"),
    };
    // CONTINUE_DUMP_REQUESTS: the body as handed to the adapter, for diffing
    dumpRequest(body);
    return await chatCompletionStreamWithBackoff(
      llmApi,
      body,
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
  // Why the model stopped: "stop", "tool_calls", or "length" when the reply
  // hit the output limit and is incomplete.
  let finishReason: string | undefined;

  try {
    const streamWithBackoff = withExponentialBackoff(
      streamFactory,
      abortController.signal,
    );

    let chunkCount = 0;
    for await (const chunk of streamWithBackoff) {
      chunkCount++;

      logger.debug("Received chunk", { chunkCount, chunk });

      requestId = firstRequestId(requestId, chunk);
      finishReason = latestFinishReason(finishReason, chunk);

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

    noteTruncation(finishReason, { requestId, outputTokens }, callbacks);

    logger.debug("Stream complete", {
      requestId,
      finishReason,
      chunkCount,
      responseLength: aiResponse.length,
      toolCallsCount: toolCallsMap.size,
      inputTokens,
      outputTokens,
      cacheReadTokens: cacheReadTokens(fullUsage?.prompt_tokens_details),
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
    finishReason,
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
  // End-of-turn nudges (core/util/turnEnd.ts): one between tool calls, a few per turn
  const nudges: TurnNudges = { sinceToolUse: 0, thisTurn: 0 };
  resetTurnGuards(isCompacting);

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
    compactionOccurredThisTurn ||= preCompactionResult.wasCompacted;

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

    // After the tools: the context-limit check on their results, then the
    // normal auto-compaction check at the model's threshold
    const afterTools = await compactAfterTools(
      toolCalls,
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
    chatHistory = afterTools.chatHistory;
    compactionOccurredThisTurn ||= afterTools.wasCompacted;

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

    // Reset the flag once a continuation went out, to avoid continuing forever
    compactionOccurredThisTurn &&= !shouldAutoContinue;
    autoContinuedLastIteration = shouldAutoContinue;

    // An announced-but-not-taken step gets a nudge (nudgeAnnouncedStep)
    const nudged = nudgeAnnouncedStep({
      content,
      shouldContinue,
      shouldAutoContinue,
      isHeadless,
      isCompacting,
      chatHistory,
      nudges,
    });
    if (nudged) {
      chatHistory = nudged;
      continue;
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
