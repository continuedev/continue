// Helper functions extracted from streamChatResponse.ts to reduce file size
/* eslint-disable max-lines */

import type { ToolStatus, Usage } from "core/index.js";
import { totalInputTokens } from "core/llm/utils/cacheStats.js";
import { calculateRequestCost } from "core/llm/utils/calculateRequestCost.js";
import { ContinueError, ContinueErrorReason } from "core/util/errors.js";
import { ChatCompletionToolMessageParam } from "openai/resources/chat/completions.mjs";

import { ToolPermissionServiceState } from "src/services/ToolPermissionService.js";
import type { ModelServiceState } from "src/services/types.js";

import { holdLoopCall, loopRepeatGuard } from "../loop/loopHolds.js";
import {
  evaluateWithCoreRules,
  getReviewer,
  isAutoReviewEnabled,
  type CoreVerdict,
} from "../permissions/coreRules.js";
import { checkToolPermission } from "../permissions/permissionChecker.js";
import { toolPermissionManager } from "../permissions/permissionManager.js";
import { withReadOnlyMcp } from "../permissions/readOnlyMcp.js";
import { ToolCallRequest, ToolPermissions } from "../permissions/types.js";
import {
  SERVICE_NAMES,
  serviceContainer,
  services,
} from "../services/index.js";
import { trackSessionUsage } from "../session.js";
import { telemetryService } from "../telemetry/telemetryService.js";
import {
  executeToolCall,
  getAllAvailableTools,
  Tool,
  TOOL_ALIASES,
  validateToolCallArgsPresent,
} from "../tools/index.js";
import { PreprocessedToolCall, ToolCall } from "../tools/types.js";
import { recordCacheTally } from "../util/cacheTally.js";
import { logger } from "../util/logger.js";

import { StreamCallbacks } from "./streamChatResponse.types.js";
import {
  runPostToolUseFailureHooks,
  runPostToolUseHooks,
  runPreToolUseHooks,
} from "./toolHooks.js";

export interface ToolResultWithStatus extends ChatCompletionToolMessageParam {
  status: ToolStatus;
}

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

let permissionPrompts: Promise<unknown> = Promise.resolve();

/**
 * Ask the person about a tool call. Prompts are shown one at a time: a
 * subagent's call can ask while the parent's permission loop is asking about
 * its next call, and the UI holds a single request, so a second prompt
 * would replace the first and leave it unanswered.
 */
export function requestUserPermission(
  toolCall: PreprocessedToolCall,
  callbacks?: StreamCallbacks,
): Promise<boolean> {
  if (!callbacks?.onToolPermissionRequest) {
    return Promise.resolve(false);
  }
  const prompt = permissionPrompts.then(() =>
    promptForPermission(toolCall, callbacks),
  );
  permissionPrompts = prompt.catch(() => undefined);
  return prompt;
}

async function promptForPermission(
  toolCall: PreprocessedToolCall,
  callbacks: StreamCallbacks,
): Promise<boolean> {
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

/**
 * The `toolPermissions` rules from config.yaml and the Auto reviewer (`--auto-review`),
 * run by core's engine. Any failure here leaves the CLI's own result in place
 * for rules, and for the reviewer it is an unusable reviewer (asks, or refuses
 * when headless), never an allow.
 */
async function coreRulesVerdict(
  toolCall: PreprocessedToolCall,
  cliPermission: "allow" | "ask",
  isHeadless?: boolean,
): Promise<CoreVerdict | undefined> {
  const autoReview = isAutoReviewEnabled();
  try {
    const modelState = await serviceContainer.get<ModelServiceState>(
      SERVICE_NAMES.MODEL,
    );
    const assistant = modelState?.assistant;
    const permissions = assistant?.toolPermissions;
    if (!permissions && !autoReview) return undefined;
    return await evaluateWithCoreRules({
      cliToolName: toolCall.name,
      args: toolCall.arguments,
      cliPermission,
      evaluateToolCallPolicy: toolCall.tool?.evaluateToolCallPolicy,
      assistantPermissions: permissions,
      autoReview,
      reviewer:
        autoReview && modelState?.authConfig
          ? getReviewer(assistant, modelState.authConfig)
          : null,
      isHeadless: !!isHeadless,
      history: autoReview ? services.chatHistory.getHistory() : undefined,
    });
  } catch (e) {
    logger.warn("Could not apply toolPermissions rules", { error: e });
    // Fail toward asking, and toward refusing when nobody can be asked.
    return autoReview || assistantHasRules()
      ? { decision: "ask", by: "system", reason: "Could not check your rules." }
      : undefined;
  }
}

function assistantHasRules(): boolean {
  try {
    const state = serviceContainer.getSync<ModelServiceState>(
      SERVICE_NAMES.MODEL,
    );
    return !!state?.value?.assistant?.toolPermissions;
  } catch {
    return false;
  }
}

// Helper function to check if tool permission is needed
export async function checkToolPermissionApproval(
  permissions: ToolPermissions,
  toolCall: PreprocessedToolCall,
  callbacks?: StreamCallbacks,
  isHeadless?: boolean,
  /** What PreToolUse hooks asked for. They can tighten the policy, never loosen an exclude. */
  hookDecision?: "allow" | "ask",
): Promise<{
  approved: boolean;
  /** "loop": Loop mode held the call as a question instead of asking */
  denialReason?: "user" | "policy" | "loop";
  /** Why a rule, protected path or the reviewer refused it, to tell the model. */
  denialMessage?: string;
}> {
  const permissionCheck = withReadOnlyMcp(
    checkToolPermission(toolCall, permissions),
    toolCall.tool,
  );
  let permission = permissionCheck.permission;

  // PreToolUse hooks adjust the CLI policy first; the CLI's own exclude
  // always stands.
  if (permission !== "exclude") {
    if (hookDecision === "ask" && permission === "allow") permission = "ask";
    else if (hookDecision === "allow" && permission === "ask") {
      permission = "allow";
    }
  }

  // Then the rules in config.yaml (deny, protected paths, ask, allow) and the
  // reviewer may tighten the result, and an allow rule may loosen an "ask",
  // but not one a hook asked for: the hook wants the user to confirm.
  if (permission !== "exclude") {
    const verdict = await coreRulesVerdict(toolCall, permission, isHeadless);
    if (verdict) {
      if (verdict.decision === "allow" && hookDecision !== "ask") {
        return { approved: true };
      }
      if (verdict.decision === "deny") {
        return {
          approved: false,
          denialReason: "policy",
          denialMessage: verdict.reason,
        };
      }
      // "ask" (or an allow rule over a hook's ask): Loop mode holds it as a
      // question; otherwise nobody to ask when headless, so it is a refusal.
      const held = holdLoopCall(toolCall, verdict.reason);
      if (held) return held;
      if (isHeadless) {
        return {
          approved: false,
          denialReason: "policy",
          denialMessage: `${verdict.reason ?? "This call needs approval."} Running headless, so it was refused.`,
        };
      }
      const userApproved = await requestUserPermission(toolCall, callbacks);
      return userApproved
        ? { approved: true }
        : { approved: false, denialReason: "user" };
    }
  }

  if (permission === "allow") {
    return { approved: true };
  } else if (permission === "ask") {
    const held = holdLoopCall(toolCall);
    if (held) return held;
    if (isHeadless) {
      // "ask" tools are excluded in headless so can only get here by policy evaluation
      return { approved: false, denialReason: "policy" };
    }
    const userApproved = await requestUserPermission(toolCall, callbacks);
    return userApproved
      ? { approved: true }
      : { approved: false, denialReason: "user" };
  } else if (permission === "exclude") {
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
      arguments: {},
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

  // Capture extra_content
  if (toolCallDelta.extra_content) {
    toolCall.extra_content = toolCallDelta.extra_content;
  }
}

/** A guess from the model name, for a config without a provider. */
function guessProviderFromName(modelName: string): string {
  const normalized = modelName.toLowerCase();
  if (normalized.includes("gpt") || normalized.includes("openai")) {
    return "openai";
  }
  return "anthropic";
}

/**
 * The provider the request's usage is counted and priced under: the model
 * config's `provider` ("bedrock", "anthropic", "openai", ...). It decides the
 * price table (a Nova model on Bedrock has its own) and whether the
 * provider's `prompt_tokens` leaves out the cache. A guess from the model
 * name was used before and priced every non-GPT model as Anthropic.
 */
export function pricingProvider(model: {
  provider?: unknown;
  model: string;
}): string {
  if (typeof model.provider === "string" && model.provider.trim()) {
    return model.provider;
  }
  return guessProviderFromName(model.model);
}

/**
 * Cost of a request to a model with no entry in the price tables: $1/MTok
 * for uncached input, $2/MTok for output, and the cache at Claude's multiples
 * of the input price (reads 0.1x, writes 1.25x), over the input the provider
 * processed (uncached plus reads plus writes). A request whose whole prompt
 * was a cache write has `promptTokens` 0 and still costs its write.
 */
function calculateFallbackCost(
  usage: Usage,
  provider: string,
  model: string,
): number {
  const read = usage.promptTokensDetails?.cachedTokens ?? 0;
  const write = usage.promptTokensDetails?.cacheWriteTokens ?? 0;
  const processed = totalInputTokens(provider, model, usage);
  const uncached = Math.max(0, processed - read - write);
  return (
    (uncached * 1 + read * 0.1 + write * 1.25 + usage.completionTokens * 2) /
    1_000_000
  );
}

/**
 * Cached input tokens from a response's usage. The adapters for Anthropic,
 * Bedrock and Gemini set `cache_read_tokens`; OpenAI-style servers (OpenAI,
 * Strata, llama.cpp) report only `cached_tokens`, which was read as none.
 */
export function cacheReadTokens(
  details: { cache_read_tokens?: number; cached_tokens?: number } | undefined,
): number | undefined {
  return details?.cache_read_tokens ?? details?.cached_tokens;
}

// Helper function to record telemetry
export function recordStreamTelemetry(options: {
  requestStartTime: number;
  responseEndTime: number;
  inputTokens: number;
  outputTokens: number;
  model: any;
  tools?: any[];
  fullUsage?: any;
}): number {
  const {
    requestStartTime,
    responseEndTime,
    inputTokens,
    outputTokens,
    model,
    tools,
    fullUsage,
  } = options;
  const totalDuration = responseEndTime - requestStartTime;

  // Calculate cost using comprehensive pricing that includes caching
  let cost: number;
  let usage: Usage;
  // True when the fallback rate priced this request (no table for the model):
  // the session total is then marked an estimate. Against the AWS list the
  // fallback reported $4.00 for a $2.35 run (research-bedrock-families.md).
  let estimated = false;
  const provider = pricingProvider(model);

  if (fullUsage) {
    // Transform API usage format to Usage interface
    usage = {
      promptTokens: fullUsage.prompt_tokens,
      completionTokens: fullUsage.completion_tokens,
      promptTokensDetails: fullUsage.prompt_tokens_details
        ? {
            cachedTokens: cacheReadTokens(fullUsage.prompt_tokens_details),
            cacheWriteTokens:
              fullUsage.prompt_tokens_details.cache_write_tokens,
            // The split by lifetime, when the adapter has one, prices a 1-hour
            // write at the 1-hour rate.
            ...(fullUsage.prompt_tokens_details.cache_write_tokens_1h !==
              undefined && {
              cacheWriteTokens5m:
                fullUsage.prompt_tokens_details.cache_write_tokens_5m,
              cacheWriteTokens1h:
                fullUsage.prompt_tokens_details.cache_write_tokens_1h,
            }),
          }
        : undefined,
    };

    // Price under the config's provider. A provider with no price table
    // (a proxy, say) falls back to the name guess, which prices Claude and
    // GPT models by their vendors' lists; anything else gets the fallback.
    const guessed = guessProviderFromName(model.model);
    const costBreakdown =
      calculateRequestCost(provider, model.model, usage) ??
      (guessed === provider
        ? null
        : calculateRequestCost(guessed, model.model, usage));

    // Use fallback for unknown models
    if (costBreakdown) {
      cost = costBreakdown.cost;
    } else {
      cost = calculateFallbackCost(usage, provider, model.model);
      estimated = true;
    }
  } else {
    // Fallback when fullUsage not available
    usage = {
      promptTokens: inputTokens,
      completionTokens: outputTokens,
    };
    cost = calculateFallbackCost(usage, provider, model.model);
    estimated = true;
  }

  // Use tokens from fullUsage if available, otherwise use the passed params
  const actualInputTokens = fullUsage?.prompt_tokens ?? inputTokens;
  const actualOutputTokens = fullUsage?.completion_tokens ?? outputTokens;

  telemetryService.recordTokenUsage(actualInputTokens, "input", model.model);
  telemetryService.recordTokenUsage(actualOutputTokens, "output", model.model);

  // Record cache tokens if available
  const cacheRead = cacheReadTokens(fullUsage?.prompt_tokens_details);
  if (cacheRead) {
    telemetryService.recordTokenUsage(cacheRead, "cacheRead", model.model);
  }
  if (fullUsage?.prompt_tokens_details?.cache_write_tokens) {
    telemetryService.recordTokenUsage(
      fullUsage.prompt_tokens_details.cache_write_tokens,
      "cacheCreation",
      model.model,
    );
  }

  telemetryService.recordCost(cost, model.model);
  // The session totals count the input the provider processed (uncached plus
  // cache reads plus writes), which needs the provider to know what its own
  // count leaves out; the cache tally does the same per request.
  trackSessionUsage(cost, usage, provider, model.model, estimated);
  recordCacheTally(provider, model.model, usage);

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
    inputTokens: actualInputTokens,
    outputTokens: actualOutputTokens,
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
  isHeadless: boolean,
  toolCalls: ToolCall[],
  callbacks?: StreamCallbacks,
): Promise<{
  preprocessedCalls: PreprocessedToolCall[];
  errorChatEntries: ChatCompletionToolMessageParam[];
}> {
  const preprocessedCalls: PreprocessedToolCall[] = [];
  const errorChatEntries: ChatCompletionToolMessageParam[] = [];

  // Get all available tools

  // Process each tool call
  for (const toolCall of toolCalls) {
    const startTime = Date.now();
    try {
      const availableTools: Tool[] = await getAllAvailableTools(isHeadless);
      const tool =
        availableTools.find((t) => t.name === toolCall.name) ??
        TOOL_ALIASES.find((t) => t.name === toolCall.name);
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
 * @returns - Chat history entries with tool results and status information
 */
// eslint-disable-next-line max-statements
export async function executeStreamedToolCalls(
  preprocessedCalls: PreprocessedToolCall[],
  callbacks?: StreamCallbacks,
  isHeadless?: boolean,
  /** The turn's signal, handed to each tool run so it can stop on cancel. */
  abortSignal?: AbortSignal,
): Promise<{
  hasRejection: boolean;
  chatHistoryEntries: ToolResultWithStatus[];
}> {
  // Strategy: queue permissions (preserve order), then run approved tools in parallel.
  // If any permission is rejected, cancel the remaining tools in this batch.
  //
  // NOTE: parallelToolCallCount is passed to each tool so they can divide their
  // output limits accordingly to avoid context overflow. Bash/Read do this for now
  const parallelToolCallCount = preprocessedCalls.length;

  type IndexedCall = { index: number; call: PreprocessedToolCall };
  const indexedCalls: IndexedCall[] = preprocessedCalls.map((call, index) => ({
    index,
    call,
  }));

  const entriesByIndex = new Map<number, ToolResultWithStatus>();
  const execPromises: Promise<void>[] = [];

  let hasRejection = false;

  // Loop mode refuses a call repeated too often in one item's run
  const loopRepeat = loopRepeatGuard(preprocessedCalls.map((c) => c.id));

  // Permission phase (sequential)
  for (const { index, call: originalCall } of indexedCalls) {
    // Do not cancel subsequent tools after a rejection; handle each independently

    // PreToolUse hooks may replace the arguments, so the call can change.
    let call = originalCall;

    try {
      const repeated = loopRepeat.check(call);
      if (repeated) {
        callbacks?.onToolStart?.(call.name, call.arguments);
        entriesByIndex.set(index, {
          role: "tool",
          tool_call_id: call.id,
          content: repeated,
          status: "canceled",
        });
        callbacks?.onToolResult?.(repeated, call.name, "canceled");
        try {
          services.chatHistory.addToolResult(call.id, repeated, "canceled");
        } catch {}
        continue;
      }

      logger.debug("Checking tool permissions", {
        name: call.name,
        arguments: call.arguments,
      });

      // Notify tool start before permission check to display in UI fallbacks
      callbacks?.onToolStart?.(call.name, call.arguments);

      // PreToolUse hooks run before the permission check, so it sees the final
      // arguments. A blocked call goes back to the model with the hook's
      // reason and is not a rejection: in headless mode a rejection ends the
      // run, but a hook's refusal is information the model can act on.
      const hookOutcome = await runPreToolUseHooks(call);
      if (hookOutcome.blockedReason) {
        const blockedEntry: ToolResultWithStatus = {
          role: "tool",
          tool_call_id: call.id,
          content: `Blocked by a hook: ${hookOutcome.blockedReason}`,
          status: "canceled",
        };
        entriesByIndex.set(index, blockedEntry);
        callbacks?.onToolResult?.(
          String(blockedEntry.content),
          call.name,
          "canceled",
        );
        try {
          services.chatHistory.addToolResult(
            call.id,
            String(blockedEntry.content),
            "canceled",
          );
        } catch {}
        continue;
      }
      call = hookOutcome.call;

      // Check tool permissions using helper
      const permissionState =
        await serviceContainer.get<ToolPermissionServiceState>(
          SERVICE_NAMES.TOOL_PERMISSIONS,
        );
      const permissionResult = await checkToolPermissionApproval(
        permissionState.permissions,
        call,
        callbacks,
        isHeadless,
        hookOutcome.decision,
      );

      if (!permissionResult.approved) {
        // Permission denied: create entry with canceled status
        const denialReason = permissionResult.denialReason || "user";
        const deniedMessage =
          denialReason === "loop"
            ? (permissionResult.denialMessage ?? "Held for the person.")
            : denialReason === "policy"
              ? permissionResult.denialMessage
                ? `Command blocked by security policy: ${permissionResult.denialMessage} Do not retry it or reach the same result another way. Do what else the request needs, then say what you could not do and why.`
                : `Command blocked by security policy`
              : `Permission denied by user`;

        const deniedEntry: ToolResultWithStatus = {
          role: "tool",
          tool_call_id: call.id,
          content: deniedMessage,
          status: "canceled",
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
        // A call Loop mode held is not a refusal: the item goes on without it
        if (denialReason !== "loop") hasRejection = true;
        // Remaining items will be auto-cancelled in subsequent iterations
        continue;
      }

      // Immediately mark as calling for instant UI feedback
      try {
        services.chatHistory.updateToolStatus(call.id, "calling");
      } catch {}

      // Start execution immediately for approved calls. `call` can be
      // reassigned by the loop, so the closure takes the value it has now.
      const approvedCall = call;
      execPromises.push(
        (async () => {
          try {
            logger.debug("Executing tool", {
              name: approvedCall.name,
              arguments: approvedCall.arguments,
            });

            const rawResult = await executeToolCall(approvedCall, {
              parallelToolCallCount,
              abortSignal,
              onToolPermissionRequest: callbacks?.onToolPermissionRequest,
            });
            const toolResult = await runPostToolUseHooks(
              approvedCall,
              rawResult,
            );
            const entry: ToolResultWithStatus = {
              role: "tool",
              tool_call_id: approvedCall.id,
              content: toolResult,
              status: "done",
            };
            entriesByIndex.set(index, entry);
            callbacks?.onToolResult?.(toolResult, approvedCall.name, "done");
            // Immediate service update for UI feedback
            try {
              services.chatHistory.addToolResult(
                approvedCall.id,
                String(toolResult),
                "done",
              );
            } catch {}
          } catch (error) {
            const errorMessage = `Error executing tool ${approvedCall.name}: ${
              error instanceof Error ? error.message : String(error)
            }`;
            logger.error("Tool execution failed", {
              name: approvedCall.name,
              error: errorMessage,
            });
            await runPostToolUseFailureHooks(approvedCall, errorMessage);
            entriesByIndex.set(index, {
              role: "tool",
              tool_call_id: approvedCall.id,
              content: errorMessage,
              status: "errored",
            });
            callbacks?.onToolError?.(errorMessage, approvedCall.name);
            // Immediate service update for UI feedback
            try {
              services.chatHistory.addToolResult(
                approvedCall.id,
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
        status: "errored",
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
  const chatHistoryEntries: ToolResultWithStatus[] = preprocessedCalls
    .map((_, index) => entriesByIndex.get(index))
    .filter((e): e is ToolResultWithStatus => !!e);

  return {
    hasRejection,
    chatHistoryEntries,
  };
}
