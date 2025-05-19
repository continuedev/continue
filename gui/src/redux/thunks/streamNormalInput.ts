import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { LLMFullCompletionOptions } from "core";
import { modelSupportsTools } from "core/llm/autodetect";
import { ToCoreProtocol } from "core/protocol";
import { selectActiveTools } from "../selectors/selectActiveTools";
import { selectCurrentToolCall } from "../selectors/selectCurrentToolCall";
import { selectSelectedChatModel } from "../slices/configSlice";
import {
  abortStream,
  addPromptCompletionPair,
  setActive,
  setAppliedRulesAtIndex,
  setInactive,
  setToolGenerated,
  setWarningMessage,
  streamUpdate,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import {
  constructMessages,
  getBaseSystemMessage,
} from "../util/constructMessages";
import { callCurrentTool } from "./callCurrentTool";

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

    // Get tools
    const activeTools = selectActiveTools(state);
    const toolsSupported = modelSupportsTools(selectedChatModel);

    // Construct completion options
    let completionOptions: LLMFullCompletionOptions = {};
    if (toolsSupported && activeTools.length > 0) {
      completionOptions = {
        tools: activeTools,
      };
    }

    if (state.session.hasReasoningEnabled) {
      completionOptions = {
        ...completionOptions,
        reasoning: true,
        reasoningBudgetTokens: completionOptions.reasoningBudgetTokens ?? 2048,
      };
    }

    // Construct messages (excluding system message)
    const baseSystemMessage = getBaseSystemMessage(
      state.session.mode,
      selectedChatModel,
    );

    const withoutMessageIds = state.session.history.map((item) => {
      const { id, ...messageWithoutId } = item.message;
      return { ...item, message: messageWithoutId };
    });
    const { messages, appliedRules, appliedRuleIndex } = constructMessages(
      withoutMessageIds,
      baseSystemMessage,
      state.config.config.rules,
      state.ui.ruleSettings,
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
    // Remove the warning message before each compileChat call
    dispatch(setWarningMessage(undefined));
    const precompiledRes = await extra.ideMessenger.request("llm/compileChat", {
      messages,
      options: completionOptions,
    });

    if (precompiledRes.status === "error") {
      throw new Error(precompiledRes.error);
    }

    const { compiledChatMessages, pruningStatus } = precompiledRes.content;

    switch (pruningStatus) {
      case "pruned":
        dispatch(
          setWarningMessage({
            message: `Chat history exceeds model's context length (${state.config.config.selectedModelByRole.chat?.contextLength} tokens). Old messages will not be included.`,
            level: "warning",
            category: "exceeded-context-length",
          }),
        );
        break;
      case "deleted-last-input":
        dispatch(
          setWarningMessage({
            message:
              "The provided context items are too large. Please trim the context item to fit the model's context length or increase the model's context length by editing the configuration.",
            level: "fatal",
            category: "deleted-last-input",
          }),
        );
        dispatch(setInactive());
        return;
    }

    // Send request and stream response
    const streamAborter = state.session.streamAborter;
    const gen = extra.ideMessenger.llmStreamChat(
      {
        completionOptions,
        title: selectedChatModel.title,
        messages: compiledChatMessages,
        legacySlashCommandData,
        messageOptions: { precompiled: true },
      },
      streamAborter.signal,
    );

    let next = await gen.next();
    while (!next.done) {
      if (!getState().session.isStreaming) {
        dispatch(abortStream());
        break;
      }

      dispatch(streamUpdate(next.value));
      next = await gen.next();
    }

    dispatch(setInactive());

    // Attach prompt log and end thinking for reasoning models
    if (next.done && next.value) {
      dispatch(addPromptCompletionPair([next.value]));

      try {
        if (state.session.mode === "chat" || state.session.mode === "agent") {
          extra.ideMessenger.post("devdata/log", {
            name: "chatInteraction",
            data: {
              prompt: next.value.prompt,
              completion: next.value.completion,
              modelProvider: selectedChatModel.underlyingProviderName,
              modelTitle: selectedChatModel.title,
              sessionId: state.session.id,
              ...(state.session.mode === "agent" && {
                tools: activeTools.map((tool) => tool.function.name),
              }),
            },
          });
        }
        // else if (state.session.mode === "edit") {
        //   extra.ideMessenger.post("devdata/log", {
        //     name: "editInteraction",
        //     data: {
        //       prompt: next.value.prompt,
        //       completion: next.value.completion,
        //       modelProvider: selectedChatModel.provider,
        //       modelTitle: selectedChatModel.title,
        //     },
        //   });
        // }
      } catch (e) {
        console.error("Failed to send dev data interaction log", e);
      }
    }

    // If it's a tool call that is automatically accepted, we should call it
    const newState = getState();
    const toolSettings = newState.ui.toolSettings;
    const toolCallState = selectCurrentToolCall(newState);
    if (toolCallState) {
      dispatch(
        setToolGenerated({
          toolCallId: toolCallState.toolCallId,
        }),
      );

      if (
        toolSettings[toolCallState.toolCall.function.name] ===
        "allowedWithoutPermission"
      ) {
        const response = await dispatch(callCurrentTool());
        unwrapResult(response);
      }
    }
  },
);
