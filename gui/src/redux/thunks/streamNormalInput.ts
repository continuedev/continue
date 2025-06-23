import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { LLMFullCompletionOptions } from "core";
import { modelSupportsTools } from "core/llm/autodetect";
import { constructMessages } from "core/llm/constructMessages";
import { ToCoreProtocol } from "core/protocol";
import { selectActiveTools } from "../selectors/selectActiveTools";
import { selectCurrentToolCall } from "../selectors/selectCurrentToolCall";
import { selectSelectedChatModel } from "../slices/configSlice";
import {
  abortStream,
  addPromptCompletionPair,
  setAppliedRulesAtIndex,
  setToolGenerated,
  streamUpdate,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
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
    // Get updated history after the update
    const state = getState();
    const selectedChatModel = selectSelectedChatModel(state);

    if (!selectedChatModel) {
      throw new Error("No chat model selected");
    }

    const { messages, appliedRules, lastMessageIndex } = constructMessages(
      state.session.mode,
      [...state.session.history],
      selectedChatModel,
      state.config.config.rules,
      state.ui.ruleSettings,
    );

    dispatch(
      setAppliedRulesAtIndex({
        index: lastMessageIndex,
        appliedRules,
      }),
    );

    const streamAborter = state.session.streamAborter;

    let completionOptions: LLMFullCompletionOptions = {};
    const activeTools = selectActiveTools(state);
    const toolsSupported = modelSupportsTools(selectedChatModel);
    if (toolsSupported && activeTools.length > 0) {
      completionOptions = {
        tools: activeTools,
      };
    }

    // Send request
    const gen = extra.ideMessenger.llmStreamChat(
      {
        completionOptions,
        title: selectedChatModel.title,
        messages,
        legacySlashCommandData,
      },
      streamAborter.signal,
    );

    // Stream response
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
