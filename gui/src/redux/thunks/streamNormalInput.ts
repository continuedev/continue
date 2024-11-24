import { createAsyncThunk } from "@reduxjs/toolkit";
import { ChatMessage, PromptLog } from "core";
import { allTools } from "core/tools";
import { defaultModelSelector } from "../selectors/modelSelectors";
import { selectCurrentToolCall } from "../selectors/selectCurrentToolCall";
import {
  abortStream,
  addPromptCompletionPair,
  clearLastEmptyResponse,
  streamUpdate,
} from "../slices/stateSlice";
import { ThunkApiType } from "../store";
import { callTool } from "./callTool";

export const streamNormalInput = createAsyncThunk<
  void,
  ChatMessage[],
  ThunkApiType
>("chat/streamNormalInput", async (messages, { dispatch, extra, getState }) => {
  try {
    // Gather state
    const state = getState();
    const defaultModel = defaultModelSelector(state);
    const toolSettings = state.uiState.toolSettings;
    const streamAborter = state.state.streamAborter;
    const useTools = state.uiState.useTools;

    if (!defaultModel) {
      throw new Error("Default model not defined");
    }

    // Send request
    const gen = extra.ideMessenger.llmStreamChat(
      defaultModel.title,
      streamAborter.signal,
      messages,
      {
        tools: useTools
          ? Object.keys(toolSettings)
              .filter((tool) => toolSettings[tool] !== "disabled")
              .map((toolName) =>
                allTools.find((tool) => tool.function.name === toolName),
              )
          : undefined,
      },
    );

    // Stream response
    let next = await gen.next();
    while (!next.done) {
      if (!getState().state.active) {
        dispatch(abortStream());
        break;
      }
      dispatch(streamUpdate(next.value as ChatMessage));
      next = await gen.next();
    }

    // Attach prompt log
    let returnVal = next.value as PromptLog;
    if (returnVal) {
      dispatch(addPromptCompletionPair([returnVal]));
    }

    // If it's a tool call that is automatically accepted, we should call it
    const toolCallState = selectCurrentToolCall(getState());
    if (
      toolCallState &&
      toolCallState.status === "generated" &&
      toolSettings[toolCallState.toolCall.function.name] ===
        "allowedWithoutPermission"
    ) {
      await dispatch(callTool());
    }
  } catch (e) {
    // If there's an error, we should clear the response so there aren't two input boxes
    dispatch(clearLastEmptyResponse());
  }
});
