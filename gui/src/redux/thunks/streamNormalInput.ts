import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { ChatMessage, LLMFullCompletionOptions, Tool } from "core";
import { getRuleId } from "core/llm/rules/getSystemMessageWithRules";
import { ToCoreProtocol } from "core/protocol";
import { selectActiveTools } from "../selectors/selectActiveTools";
import { selectSelectedChatModel } from "../slices/configSlice";
import {
  abortStream,
  addPromptCompletionPair,
  errorToolCall,
  setActive,
  setAppliedRulesAtIndex,
  setContextPercentage,
  setInactive,
  setInlineErrorMessage,
  setIsPruned,
  setToolCallArgs,
  setToolGenerated,
  streamUpdate,
  updateToolCallOutput,
} from "../slices/sessionSlice";
import { AppThunkDispatch, RootState, ThunkApiType } from "../store";
import { constructMessages } from "../util/constructMessages";

import { modelSupportsNativeTools } from "core/llm/toolSupport";
import { addSystemMessageToolsToSystemMessage } from "core/tools/systemMessageTools/buildToolsSystemMessage";
import { interceptSystemToolCalls } from "core/tools/systemMessageTools/interceptSystemToolCalls";
import { SystemMessageToolCodeblocksFramework } from "core/tools/systemMessageTools/toolCodeblocks";
import { renderContextItems } from "core/util/messageContent";
import { IIdeMessenger } from "../../context/IdeMessenger";
import { selectCurrentToolCalls } from "../selectors/selectToolCalls";
import { DEFAULT_TOOL_SETTING } from "../slices/uiSlice";
import { getBaseSystemMessage } from "../util/getBaseSystemMessage";
import { callToolById } from "./callToolById";
import { validateAndEnhanceToolCallArgs } from "./enhanceParsedArgs";

async function preprocessToolCalls(
  dispatch: AppThunkDispatch,
  getState: () => RootState,
  ideMessenger: IIdeMessenger,
): Promise<void> {
  const state = getState();
  const toolCalls = selectCurrentToolCalls(state);
  const generatingCalls = toolCalls.filter((tc) => tc.status === "generating");

  // Tool call pre-processing
  await Promise.all(
    generatingCalls.map(async (tcState) => {
      try {
        const changedArgs = await validateAndEnhanceToolCallArgs(
          ideMessenger,
          tcState?.toolCall.function.name,
          tcState.parsedArgs,
        );
        if (changedArgs) {
          dispatch(
            setToolCallArgs({
              toolCallId: tcState.toolCallId,
              newArgs: changedArgs,
            }),
          );
        }
      } catch (e) {
        let errorMessage = e instanceof Error ? e.message : `Unknown error`;
        dispatch(
          errorToolCall({
            toolCallId: tcState.toolCallId,
          }),
        );
        dispatch(
          updateToolCallOutput({
            toolCallId: tcState.toolCallId,
            contextItems: [
              {
                icon: "problems",
                name: "Invalid Tool Call",
                description: "",
                content: `${tcState.toolCall.function.name} failed because the arguments were invalid, with the following message: ${errorMessage}\n\nPlease try something else or request further instructions.`,
                hidden: false,
              },
            ],
          }),
        );
      }
    }),
  );
}

/**
 * Handles the execution of tool calls that may be automatically accepted.
 * Sets all tools as generated first, then executes auto-approved tool calls.
 */
async function executeToolCalls(
  dispatch: AppThunkDispatch,
  getState: () => RootState,
  activeTools: Tool[],
): Promise<void> {
  const state = getState();
  const toolSettings = state.ui.toolSettings;
  const toolCalls = selectCurrentToolCalls(state);

  const generatingToolCalls = toolCalls.filter(
    (toolCallState) => toolCallState.status === "generating",
  );

  // We will stop streaming only if any need approval
  const anyNeedApproval = generatingToolCalls.find((toolCallState) => {
    const toolPolicy =
      toolSettings[toolCallState.toolCall.function.name] ??
      activeTools.find(
        (tool) => tool.function.name === toolCallState.toolCall.function.name,
      )?.defaultToolPolicy ??
      DEFAULT_TOOL_SETTING;
    return toolPolicy !== "allowedWithoutPermission";
  });

  // Set all tools as generated first
  generatingToolCalls.forEach((toolCallState) => {
    dispatch(
      setToolGenerated({
        toolCallId: toolCallState.toolCallId,
        tools: state.config.config.tools,
      }),
    );
  });

  // Case 1: No tool calls OR tool calls require approval -> stop streaming
  // This prevents UI flashing for auto-approved tools while still showing approval UI for others
  if (toolCalls.length === 0 || anyNeedApproval) {
    dispatch(setInactive());
  } else if (generatingToolCalls.length > 0) {
    // Case 2: All auto approved -> call them!
    const toolCallPromises = generatingToolCalls.map(async ({ toolCallId }) => {
      const response = await dispatch(
        callToolById({ toolCallId, autoApproved: true }),
      );
      unwrapResult(response);
    });
    await Promise.all(toolCallPromises);
  } else {
    // Case 3: All errored -> stream on!
    for (const { output, toolCallId } of toolCalls) {
      const newMessage: ChatMessage = {
        role: "tool",
        content: output ? renderContextItems(output) : "",
        toolCallId,
      };
      dispatch(streamUpdate([newMessage]));
    }
    unwrapResult(await dispatch(streamNormalInput({})));
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
    console.log(messages);

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

    await preprocessToolCalls(dispatch, getState, extra.ideMessenger);
    await executeToolCalls(dispatch, getState, activeTools);
  },
);
