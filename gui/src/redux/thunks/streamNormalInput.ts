import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { LLMFullCompletionOptions, Tool } from "core";
import { getRuleId } from "core/llm/rules/getSystemMessageWithRules";
import { ToCoreProtocol } from "core/protocol";
import { selectActiveTools } from "../selectors/selectActiveTools";
import { selectSelectedChatModel } from "../slices/configSlice";
import {
  abortStream,
  addPromptCompletionPair,
  setActive,
  setAppliedRulesAtIndex,
  setContextPercentage,
  setInactive,
  setInlineErrorMessage,
  setIsPruned,
  setToolGenerated,
  streamUpdate,
} from "../slices/sessionSlice";
import { AppThunkDispatch, RootState, ThunkApiType } from "../store";
import { constructMessages } from "../util/constructMessages";

import { modelSupportsNativeTools } from "core/llm/toolSupport";
import { addSystemMessageToolsToSystemMessage } from "core/tools/systemMessageTools/buildToolsSystemMessage";
import { interceptSystemToolCalls } from "core/tools/systemMessageTools/interceptSystemToolCalls";
import { SystemMessageToolCodeblocksFramework } from "core/tools/systemMessageTools/toolCodeblocks";
import { selectCurrentToolCalls } from "../selectors/selectToolCalls";
import { DEFAULT_TOOL_SETTING } from "../slices/uiSlice";
import { getBaseSystemMessage } from "../util/getBaseSystemMessage";
import { callToolById } from "./callToolById";
import { enhanceParsedArgs } from "./enhanceParsedArgs";
/**
 * Handles the execution of tool calls that may be automatically accepted.
 * Sets all tools as generated first, then executes auto-approved tool calls.
 */
async function handleToolCallExecution(
  dispatch: AppThunkDispatch,
  getState: () => RootState,
  activeTools: Tool[],
): Promise<void> {
  const newState = getState();
  const toolSettings = newState.ui.toolSettings;
  const allToolCallStates = selectCurrentToolCalls(newState);

  // Only process tool calls that are in "generating" status (newly created during this streaming session)
  const toolCallStates = allToolCallStates.filter(
    (toolCallState) => toolCallState.status === "generating",
  );

  // If no generating tool calls, nothing to process
  if (toolCallStates.length === 0) {
    return;
  }

  // Check if ALL tool calls are auto-approved - if not, wait for user approval
  const allAutoApproved = toolCallStates.every((toolCallState) => {
    const toolPolicy =
      toolSettings[toolCallState.toolCall.function.name] ??
      activeTools.find(
        (tool) => tool.function.name === toolCallState.toolCall.function.name,
      )?.defaultToolPolicy ??
      DEFAULT_TOOL_SETTING;
    return toolPolicy == "allowedWithoutPermission";
  });

  // Set all tools as generated first
  toolCallStates.forEach((toolCallState) => {
    dispatch(
      setToolGenerated({
        toolCallId: toolCallState.toolCallId,
        tools: newState.config.config.tools,
      }),
    );
  });

  // Only run if we have auto-approve for all
  if (allAutoApproved && toolCallStates.length > 0) {
    const toolCallPromises = toolCallStates.map(async (toolCallState) => {
      const response = await dispatch(
        callToolById({ toolCallId: toolCallState.toolCallId }),
      );
      unwrapResult(response);
    });

    await Promise.all(toolCallPromises);
  }
}

export const streamNormalInput = createAsyncThunk<
  void,
  {
    legacySlashCommandData?: ToCoreProtocol["llm/streamChat"][0]["legacySlashCommandData"];
  },
  ThunkApiType
>(
  "chat/streamNormalInput",
  async ({ legacySlashCommandData }, { dispatch, extra, getState }) => {
    const state = getState();
    const selectedChatModel = selectSelectedChatModel(state);

    if (!selectedChatModel) {
      throw new Error("No chat model selected");
    }

    // Get tools and filter them based on the selected model
    const activeTools = selectActiveTools(state);

    // Use the centralized selector to determine if system message tools should be used
    const useNativeTools = state.config.config.experimental
      ?.onlyUseSystemMessageTools
      ? false
      : modelSupportsNativeTools(selectedChatModel);
    const systemToolsFramework = !useNativeTools
      ? new SystemMessageToolCodeblocksFramework()
      : undefined;

    // Construct completion options
    let completionOptions: LLMFullCompletionOptions = {};
    if (useNativeTools && activeTools.length > 0) {
      completionOptions = {
        tools: activeTools,
      };
    }

    if (state.session.hasReasoningEnabled) {
      completionOptions = {
        ...completionOptions,
        reasoning: true,
        reasoningBudgetTokens:
          selectedChatModel.completionOptions?.reasoningBudgetTokens ?? 2048,
      };
    }

    // Construct messages (excluding system message)
    const baseSystemMessage = getBaseSystemMessage(
      state.session.mode,
      selectedChatModel,
      activeTools,
    );

    const systemMessage = systemToolsFramework
      ? addSystemMessageToolsToSystemMessage(
          systemToolsFramework,
          baseSystemMessage,
          activeTools,
        )
      : baseSystemMessage;

    const withoutMessageIds = state.session.history.map((item) => {
      const { id, ...messageWithoutId } = item.message;
      return { ...item, message: messageWithoutId };
    });

    const { messages, appliedRules, appliedRuleIndex } = constructMessages(
      withoutMessageIds,
      systemMessage,
      state.config.config.rules,
      state.ui.ruleSettings,
      systemToolsFramework,
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

    const precompiledRes = await extra.ideMessenger.request("llm/compileChat", {
      messages,
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

    // Send request and stream response
    const streamAborter = state.session.streamAborter;
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
      gen = interceptSystemToolCalls(gen, streamAborter, systemToolsFramework);
    }

    let next = await gen.next();
    while (!next.done) {
      if (!getState().session.isStreaming) {
        dispatch(abortStream());
        break;
      }

      dispatch(streamUpdate(next.value));
      next = await gen.next();
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
                rule: rule.rule,
                slug: rule.slug,
              })),
            }),
          },
        });
      } catch (e) {
        console.error("Failed to send dev data interaction log", e);
      }
    }

    // Check if we have any tool calls that were just generated
    const newState = getState();
    const toolSettings = newState.ui.toolSettings;
    const allToolCallStates = selectCurrentToolCalls(newState);

    await Promise.all(
      allToolCallStates.map((tcState) =>
        enhanceParsedArgs(
          extra.ideMessenger,
          dispatch,
          tcState?.toolCall.function.name,
          tcState.toolCallId,
          tcState.parsedArgs,
        ),
      ),
    );

    const generatingToolCalls = allToolCallStates.filter(
      (toolCallState) => toolCallState.status === "generating",
    );

    // Check if ALL generating tool calls are auto-approved
    const allAutoApproved =
      generatingToolCalls.length > 0 &&
      generatingToolCalls.every((toolCallState) => {
        const toolPolicy =
          toolSettings[toolCallState.toolCall.function.name] ??
          activeTools.find(
            (tool) =>
              tool.function.name === toolCallState.toolCall.function.name,
          )?.defaultToolPolicy ??
          DEFAULT_TOOL_SETTING;
        return toolPolicy == "allowedWithoutPermission";
      });

    // Only set inactive if:
    // 1. There are no tool calls, OR
    // 2. There are tool calls but they require manual approval
    // This prevents UI flashing for auto-approved tools while still showing approval UI for others
    if (generatingToolCalls.length === 0 || !allAutoApproved) {
      dispatch(setInactive());
    }

    await handleToolCallExecution(dispatch, getState, activeTools);
  },
);
