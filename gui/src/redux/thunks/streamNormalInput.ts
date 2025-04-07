import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { ChatMessage } from "core";
import { modelSupportsTools } from "core/llm/autodetect";
import { ToCoreProtocol } from "core/protocol";
import { selectCurrentToolCall } from "../selectors/selectCurrentToolCall";
import { selectDefaultModel } from "../slices/configSlice";
import {
  abortStream,
  addPromptCompletionPair,
  selectUseTools,
  setToolGenerated,
  setWarningMessage,
  streamUpdate,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { callTool } from "./callTool";

export const streamNormalInput = createAsyncThunk<
  void,
  {
    messages: ChatMessage[];
    legacySlashCommandData?: ToCoreProtocol["llm/streamChat"][0]["legacySlashCommandData"];
  },
  ThunkApiType
>(
  "chat/streamNormalInput",
  async (
    { messages, legacySlashCommandData },
    { dispatch, extra, getState },
  ) => {
    // Gather state
    const state = getState();
    const defaultModel = selectDefaultModel(state);
    const toolSettings = state.ui.toolSettings;
    const toolGroupSettings = state.ui.toolGroupSettings;
    const streamAborter = state.session.streamAborter;
    const useTools = selectUseTools(state);
    if (!defaultModel) {
      throw new Error("Default model not defined");
    }
    const includeTools = useTools && modelSupportsTools(defaultModel);

    const res = await extra.ideMessenger.request("llm/compileChat", {
      title: defaultModel.title,
      messages,
      options: includeTools
        ? {
            tools: state.config.config.tools.filter(
              (tool) =>
                toolSettings[tool.function.name] !== "disabled" &&
                toolGroupSettings[tool.group] !== "exclude",
            ),
          }
        : {},
    });

    if (res.status === "error") {
      throw new Error(res.error);
    }

    const { compiledChatMessages, lastMessageTruncated } = res.content;

    if (lastMessageTruncated) {
      dispatch(
        setWarningMessage(
          "The provided context items are too large. They have been truncated to fit within the model's context length.",
        ),
      );
    }

    // Send request
    const gen = extra.ideMessenger.llmStreamChat(
      {
        completionOptions: includeTools
          ? {
              tools: state.config.config.tools.filter(
                (tool) =>
                  toolSettings[tool.function.name] !== "disabled" &&
                  toolGroupSettings[tool.group] !== "exclude",
              ),
            }
          : {},
        title: defaultModel.title,
        messages: compiledChatMessages,
        legacySlashCommandData,
        messageOptions: { precompiled: true },
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
              modelProvider: defaultModel.provider,
              modelTitle: defaultModel.title,
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
        //       modelProvider: defaultModel.provider,
        //       modelTitle: defaultModel.title,
        //     },
        //   });
        // }
      } catch (e) {
        console.error("Failed to send dev data interaction log", e);
      }
    }

    // If it's a tool call that is automatically accepted, we should call it
    const toolCallState = selectCurrentToolCall(getState());
    if (toolCallState) {
      dispatch(setToolGenerated());

      if (
        toolSettings[toolCallState.toolCall.function.name] ===
        "allowedWithoutPermission"
      ) {
        const response = await dispatch(callTool());
        unwrapResult(response);
      }
    }
  },
);
