import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { LLMFullCompletionOptions } from "core";
import { constructMessages } from "core/llm/constructMessages";
import { modelIsGreatWithNativeTools } from "core/llm/toolSupport";
import { ToCoreProtocol } from "core/protocol";
import { interceptXMLToolCalls } from "core/tools/instructionTools/interceptXmlToolCalls";
import { getBaseSystemMessage } from "../../util";
import { selectActiveTools } from "../selectors/selectActiveTools";
import { selectCurrentToolCall } from "../selectors/selectCurrentToolCall";
import { selectSelectedChatModel } from "../slices/configSlice";
import {
  abortStream,
  addPromptCompletionPair,
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
    // Gather state
    const state = getState();
    const selectedChatModel = selectSelectedChatModel(state);

    if (!selectedChatModel) {
      throw new Error("Default model not defined");
    }

    const messageMode = state.session.mode;

    const activeTools = selectActiveTools(state);
    const useNative = modelIsGreatWithNativeTools(selectedChatModel);

    // Set up completions options with tools
    const completionOptions: LLMFullCompletionOptions =
      useNative && !!activeTools.length
        ? {
            tools: activeTools,
          }
        : {};

    const baseChatOrAgentSystemMessage = getBaseSystemMessage(
      selectedChatModel,
      messageMode,
      useNative ? [] : activeTools,
    );

    const messages = constructMessages(
      messageMode,
      [...state.session.history],
      baseChatOrAgentSystemMessage,
      state.config.config.rules,
    );

    // Send request
    const streamAborter = state.session.streamAborter;
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
    const withMiddleware = interceptXMLToolCalls(gen);
    let next = await withMiddleware.next();
    while (!next.done) {
      if (!getState().session.isStreaming) {
        dispatch(abortStream());
        break;
      }

      dispatch(streamUpdate(next.value));
      next = await withMiddleware.next();
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
              modelProvider: selectedChatModel.provider,
              modelTitle: selectedChatModel.title,
              sessionId: state.session.id,
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
