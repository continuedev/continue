import { createAsyncThunk } from "@reduxjs/toolkit";
import { ChatMessage, PromptLog } from "core";
import { selectCurrentToolCall } from "../selectors/selectCurrentToolCall";
import { selectDefaultModel } from "../slices/configSlice";
import {
  abortStream,
  addPromptCompletionPair,
  setToolGenerated,
  streamUpdate,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { callTool } from "./callTool";
import { modelSupportsTools } from "core/llm/autodetect";

export const streamNormalInput = createAsyncThunk<
  void,
  ChatMessage[],
  ThunkApiType
>("chat/streamNormalInput", async (messages, { dispatch, extra, getState }) => {
  // Gather state
  const state = getState();
  const defaultModel = selectDefaultModel(state);
  const toolSettings = state.ui.toolSettings;
  const streamAborter = state.session.streamAborter;
  const useTools = state.ui.useTools;
  if (!defaultModel) {
    throw new Error("Default model not defined");
  }

  const includeTools =
    useTools && modelSupportsTools(defaultModel.model, defaultModel.provider);

  // Send request
  const gen = extra.ideMessenger.llmStreamChat(
    defaultModel.title,
    streamAborter.signal,
    messages,
    includeTools
      ? {
          tools: state.config.config.tools.filter(
            (tool) => toolSettings[tool.function.name] !== "disabled",
          ),
        }
      : {},
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

  // Attach prompt log
  if (next.done && next.value) {
    dispatch(addPromptCompletionPair([next.value]));
  }

  // If it's a tool call that is automatically accepted, we should call it
  const toolCallState = selectCurrentToolCall(getState());
  if (toolCallState) {
    dispatch(setToolGenerated());

    if (
      toolSettings[toolCallState.toolCall.function.name] ===
      "allowedWithoutPermission"
    ) {
      await dispatch(callTool());
    }
  }
});
