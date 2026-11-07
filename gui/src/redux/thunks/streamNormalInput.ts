import { selectCacheSetting } from "../selectors/selectCacheSetting";
import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { LLMFullCompletionOptions, ModelDescription } from "core";
import { getRuleId } from "core/llm/rules/getSystemMessageWithRules";
import { ToCoreProtocol } from "core/protocol";
import { renderChatMessage } from "core/util/messageContent";
import { BUILT_IN_GROUP_NAME } from "core/tools/builtIn";
import { selectSelectedChatModel } from "../slices/configSlice";
import {
  abortStream,
  addPromptCompletionPair,
  errorToolCall,
  setActive,
  setAppliedRulesAtIndex,
  addRequestUsageToSession,
  setContextPercentage,
  setInactive,
  setInlineErrorMessage,
  setIsPruned,
  setPromptCacheInputTokens,
  setPromptCacheKey,
  setPromptCacheRequestAt,
  setPromptReadSpeed,
  setPromptProgress,
  setPromptCacheState,
  recordCacheMiss,
  recordCacheRequest,
  requestQueuedMessagesSend,
  setToolGenerated,
  streamUpdate,
} from "../slices/sessionSlice";
import {
  resolvePromptCache,
  INITIAL_PROMPT_CACHE_STATE,
  modelSupportsOneHourCache,
  modelSupportsPromptCacheControl,
  modelUsesLocalPrefixCache,
  LOCAL_CACHE_WARM_MS,
  promptCacheStatus,
} from "../../util/promptCache";
import { buildLedgerEntry } from "../../util/cacheLedger";
import { splitPromptProgress } from "../../util/promptProgress";
import {
  detectCacheMiss,
  expectedRebuildCauses,
  promptCacheKey,
} from "../../util/cacheSafeguards";
import { totalInputTokens } from "core/llm/utils/cacheStats";
import { ThunkApiType } from "../store";
import { buildChatRequest } from "../util/buildChatRequest";

import { interceptSystemToolCalls } from "core/tools/systemMessageTools/interceptSystemToolCalls";

import {
  selectCurrentToolCalls,
  selectPendingToolCalls,
} from "../selectors/selectToolCalls";
import { callToolById } from "./callToolById";
import {
  selectApprovalSettings,
  selectAutoApproval,
} from "../selectors/selectAutoApproval";
import {
  buildReviewHistory,
  evaluateToolPolicies,
} from "./evaluateToolPolicies";
import { preprocessToolCalls } from "./preprocessToolCallArgs";
import { streamResponseAfterToolCall } from "./streamResponseAfterToolCall";

export const streamNormalInput = createAsyncThunk<
  void,
  {
    legacySlashCommandData?: ToCoreProtocol["llm/streamChat"][0]["legacySlashCommandData"];
    depth?: number;
  },
  ThunkApiType
>(
  "chat/streamNormalInput",
  async (
    { legacySlashCommandData, depth = 0 },
    { dispatch, extra, getState },
  ) => {
    if (process.env.NODE_ENV === "test" && depth > 50) {
      const message = `Max stream depth of ${50} reached in test`;
      console.error(message, JSON.stringify(getState(), null, 2));
      throw new Error(message);
    }
    const state = getState();
    const selectedChatModel = selectSelectedChatModel(state);

    if (!selectedChatModel) {
      throw new Error("No chat model selected");
    }

    // Tools, reasoning, system message and messages: one function builds them,
    // and the compaction request calls it too, so the two start with the same bytes.
    const {
      activeTools,
      completionOptions: builtOptions,
      messages,
      taskListMessage,
      appliedRules,
      appliedRuleIndex,
      systemToolsFramework,
    } = buildChatRequest(state);
    let completionOptions: LLMFullCompletionOptions = builtOptions;

    // Prompt caching: the toolbar choice for this model, or when there is none
    // the default for this mode (see effectiveCacheSetting). Auto learns from
    // the pauses between requests this session.
    const cacheStateBefore =
      state.session.promptCache ?? INITIAL_PROMPT_CACHE_STATE;
    const cacheSetting = selectCacheSetting(state);
    // A local server caches every prompt on its own, with no setting
    const localCache = modelUsesLocalPrefixCache(selectedChatModel);
    const cachingWasOn =
      localCache ||
      (modelSupportsPromptCacheControl(selectedChatModel) &&
        promptCacheStatus(selectedChatModel, cacheSetting, cacheStateBefore, 0)
          .on);
    const cacheResolution = resolvePromptCache(
      selectedChatModel,
      cacheSetting,
      cacheStateBefore,
      Date.now(),
      state.session.mode,
    );
    completionOptions = { ...completionOptions, ...cacheResolution.options };
    if (cacheResolution.nextState !== state.session.promptCache) {
      dispatch(setPromptCacheState(cacheResolution.nextState));
    }

    // What the cached prefix is made of: the model, the tools and the system
    // prompt. A change to any of them rebuilds the cache. The system prompt is
    // the final one: base message, matched rules and any conversation summary,
    // so a rule that starts to match is noticed.
    const finalSystem = messages.find((m) => m.role === "system");
    const cacheKey = promptCacheKey(
      selectedChatModel,
      activeTools.map((t) => t.function.name),
      finalSystem ? renderChatMessage(finalSystem) : undefined,
      // Each message after the system one, so an edit or removal of an earlier
      // message is told apart from a conversation that only grew.
      messages.filter((m) => m.role !== "system"),
    );

    // TODO parallel tool calls will cause issues with this
    // because there will be multiple tool messages, so which one should have applied rules?
    dispatch(
      setAppliedRulesAtIndex({
        index: appliedRuleIndex,
        appliedRules: appliedRules,
      }),
    );

    dispatch(setActive());
    dispatch(setInlineErrorMessage(undefined));

    // The task list goes last, after the history and after the conversation's
    // cache point, so a change to it leaves the cached prefix untouched (see
    // core/util/taskPlan.ts). It is not part of the cache key above.
    const precompiledRes = await extra.ideMessenger.request("llm/compileChat", {
      messages: taskListMessage ? [...messages, taskListMessage] : messages,
      options: completionOptions,
    });

    if (precompiledRes.status === "error") {
      if (precompiledRes.error.includes("Not enough context")) {
        dispatch(setInlineErrorMessage("out-of-context"));
        dispatch(setInactive());
        return;
      } else {
        throw new Error(precompiledRes.error);
      }
    }

    const { compiledChatMessages, didPrune, contextPercentage } =
      precompiledRes.content;

    dispatch(setIsPruned(didPrune));
    dispatch(setContextPercentage(contextPercentage));

    const start = Date.now();
    const streamAborter = state.session.streamAborter;
    try {
      let gen = extra.ideMessenger.llmStreamChat(
        {
          completionOptions,
          title: selectedChatModel.title,
          messages: compiledChatMessages,
          legacySlashCommandData,
          messageOptions: { precompiled: true },
        },
        streamAborter.signal,
      );
      if (systemToolsFramework && activeTools.length > 0) {
        gen = interceptSystemToolCalls(
          gen,
          streamAborter,
          systemToolsFramework,
        );
      }

      let next = await gen.next();
      while (!next.done) {
        if (!getState().session.isStreaming) {
          dispatch(abortStream());
          break;
        }

        // A local server's prompt-reading updates go to the toolbar, not the
        // conversation; the first part of the reply clears them
        const { progress, reply } = splitPromptProgress(next.value);
        if (progress) {
          dispatch(setPromptProgress(progress));
        } else if (getState().session.promptProgress) {
          dispatch(setPromptProgress(undefined));
        }
        if (reply.length > 0) dispatch(streamUpdate(reply));

        // The final chunk carries the API's token counts. Remember the input
        // size so the cache button can say what throwing the cache away costs,
        // and check that a cache that should have been warm was read.
        for (const message of next.value) {
          if (message.role === "assistant" && message.usage) {
            const total = totalInputTokens(
              selectedChatModel.provider,
              selectedChatModel.model,
              message.usage,
            );
            if (total > 0) {
              let missCauses: string[] | undefined;
              if (cachingWasOn) {
                const request = {
                  before: cacheStateBefore,
                  key: cacheKey,
                  requestAt: localCache
                    ? start
                    : (cacheResolution.nextState.lastRequestAt ?? start),
                  ...(localCache && { lifetimeMs: LOCAL_CACHE_WARM_MS }),
                  readTokens:
                    message.usage.promptTokensDetails?.cachedTokens ?? 0,
                  totalInputTokens: total,
                };
                const miss = detectCacheMiss({ ...request, pruned: didPrune });
                if (miss) {
                  missCauses = miss.causes;
                  dispatch(
                    recordCacheMiss({
                      readTokens: miss.readTokens,
                      expectedTokens: miss.expectedTokens,
                      causes: miss.causes,
                    }),
                  );
                } else {
                  // Not a fault, but the cache was not read either: a model
                  // switch or a shortened conversation. Recorded so the
                  // session summary can count it as an expected rebuild.
                  missCauses = expectedRebuildCauses(request);
                }
              }
              // One in-memory record per request, for the session's own
              // statistics. Counts and timings only.
              dispatch(
                recordCacheRequest(
                  buildLedgerEntry({
                    at: start,
                    mode: state.session.mode,
                    provider: selectedChatModel.provider,
                    model: selectedChatModel.model,
                    cachingOn: !!cachingWasOn,
                    ttl: cacheResolution.nextState.lastTtl,
                    oneHour: modelSupportsOneHourCache(selectedChatModel),
                    usage: message.usage,
                    pruned: didPrune,
                    missCauses,
                  }),
                ),
              );
              dispatch(setPromptCacheInputTokens(total));
              dispatch(setPromptCacheKey(cacheKey));
              if (localCache) {
                dispatch(setPromptCacheRequestAt(start));
                // Only a read of some size says much about the speed
                const speed = message.usage.promptTokensPerSecond;
                const read =
                  total -
                  (message.usage.promptTokensDetails?.cachedTokens ?? 0);
                if (speed && read >= 1000) dispatch(setPromptReadSpeed(speed));
              }
            }
            dispatch(
              addRequestUsageToSession({
                provider: selectedChatModel.provider,
                model: selectedChatModel.model,
                usage: message.usage,
              }),
            );
          }
        }
        next = await gen.next();
      }
      if (getState().session.promptProgress) {
        dispatch(setPromptProgress(undefined));
      }

      // Attach prompt log and end thinking for reasoning models
      if (next.done && next.value) {
        dispatch(addPromptCompletionPair([next.value]));

        try {
          extra.ideMessenger.post("devdata/log", {
            name: "chatInteraction",
            data: {
              prompt: next.value.prompt,
              completion: next.value.completion,
              modelProvider: selectedChatModel.underlyingProviderName,
              modelName: selectedChatModel.title,
              modelTitle: selectedChatModel.title,
              sessionId: state.session.id,
              ...(!!activeTools.length && {
                tools: activeTools.map((tool) => tool.function.name),
              }),
              ...(appliedRules.length > 0 && {
                rules: appliedRules.map((rule) => ({
                  id: getRuleId(rule),
                  slug: rule.slug,
                })),
              }),
            },
          });
        } catch (e) {
          console.error("Failed to send dev data interaction log", e);
        }
      }
    } catch (e) {
      const toolCallsToCancel = selectCurrentToolCalls(getState());
      if (
        toolCallsToCancel.length > 0 &&
        e instanceof Error &&
        e.message.toLowerCase().includes("premature close")
      ) {
        for (const tc of toolCallsToCancel) {
          dispatch(
            errorToolCall({
              toolCallId: tc.toolCallId,
              output: [
                {
                  name: "Tool Call Error",
                  description: "Premature Close",
                  content: `"Premature Close" error: this tool call was aborted mid-stream because the arguments took too long to stream or there were network issues. Please re-attempt by breaking the operation into smaller chunks or trying something else`,
                  icon: "problems",
                },
              ],
            }),
          );
        }
      } else {
        throw e;
      }
    }

    // Tool call sequence:
    // 1. Mark generating tool calls as generated
    const state1 = getState();
    if (streamAborter.signal.aborted || !state1.session.isStreaming) {
      return;
    }
    const originalToolCalls = selectCurrentToolCalls(state1);
    const generatingCalls = originalToolCalls.filter(
      (tc) => tc.status === "generating",
    );
    for (const { toolCallId } of generatingCalls) {
      dispatch(
        setToolGenerated({
          toolCallId,
          tools: state1.config.config.tools,
        }),
      );
    }

    // 2. Pre-process args to catch invalid args before checking policies
    const state2 = getState();
    if (streamAborter.signal.aborted || !state2.session.isStreaming) {
      return;
    }
    const generatedCalls2 = selectPendingToolCalls(state2);
    await preprocessToolCalls(dispatch, extra.ideMessenger, generatedCalls2);

    // 3. Security check: evaluate updated policies based on args
    const state3 = getState();
    if (streamAborter.signal.aborted || !state3.session.isStreaming) {
      return;
    }
    const generatedCalls3 = selectPendingToolCalls(state3);
    const toolPolicies = state3.ui.toolSettings;
    const policies = await evaluateToolPolicies(
      dispatch,
      extra.ideMessenger,
      activeTools,
      generatedCalls3,
      toolPolicies,
      selectAutoApproval(state3).active
        ? {
            sessionId: state3.session.id,
            history: buildReviewHistory(state3.session.history),
            onceGrants: state3.blockedCalls.grants,
          }
        : undefined,
      selectApprovalSettings(state3),
      state3.session.mode,
    );
    const autoApprovedPolicies = policies.filter(
      ({ policy }) => policy === "allowedWithoutPermission",
    );
    const needsApprovalPolicies = policies.filter(
      ({ policy }) => policy === "allowedWithPermission",
    );

    // 4. Execute remaining tool calls
    if (originalToolCalls.length === 0) {
      dispatch(setInactive());
      // A reply without tool calls ends the agent's turn: messages queued
      // while it worked can go now (waiting for approval is not an end)
      dispatch(requestQueuedMessagesSend());
    } else if (needsApprovalPolicies.length > 0) {
      const builtInReadonlyAutoApproved = autoApprovedPolicies.filter(
        ({ toolCallState }) =>
          toolCallState.tool?.group === BUILT_IN_GROUP_NAME &&
          toolCallState.tool?.readonly,
      );

      if (builtInReadonlyAutoApproved.length > 0) {
        const state4 = getState();
        if (streamAborter.signal.aborted || !state4.session.isStreaming) {
          return;
        }
        await Promise.all(
          builtInReadonlyAutoApproved.map(async ({ toolCallState }) => {
            unwrapResult(
              await dispatch(
                callToolById({
                  toolCallId: toolCallState.toolCallId,
                  isAutoApproved: true,
                  depth: depth + 1,
                }),
              ),
            );
          }),
        );
      }

      dispatch(setInactive());
    } else {
      // auto stream cases increase thunk depth by 1 for debugging
      const state4 = getState();
      const generatedCalls4 = selectPendingToolCalls(state4);
      if (streamAborter.signal.aborted || !state4.session.isStreaming) {
        return;
      }
      if (generatedCalls4.length > 0) {
        await Promise.all(
          generatedCalls4.map(async ({ toolCallId }) => {
            unwrapResult(
              await dispatch(
                callToolById({
                  toolCallId,
                  isAutoApproved: true,
                  depth: depth + 1,
                }),
              ),
            );
          }),
        );
      } else {
        for (const { toolCallId } of originalToolCalls) {
          unwrapResult(
            await dispatch(
              streamResponseAfterToolCall({
                toolCallId,
                depth: depth + 1,
              }),
            ),
          );
        }
      }
    }
  },
);
