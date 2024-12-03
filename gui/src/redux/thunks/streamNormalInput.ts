import { createAsyncThunk } from "@reduxjs/toolkit";
import { ChatMessage, PromptLog } from "core";
import { selectCurrentToolCall } from "../selectors/selectCurrentToolCall";
import {
  abortStream,
  addPromptCompletionPair,
  clearLastEmptyResponse,
  setToolGenerated,
  streamUpdate,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { callTool } from "./callTool";
import { selectDefaultModel } from "../slices/configSlice";

export const streamNormalInput = createAsyncThunk<
  void,
  ChatMessage[],
  ThunkApiType
>("chat/streamNormalInput", async (messages, { dispatch, extra, getState }) => {
  try {
    // Gather state
    const state = getState();
    const defaultModel = selectDefaultModel(state);
    const toolSettings = state.ui.toolSettings;
    const streamAborter = state.session.streamAborter;
    const useTools = state.ui.useTools;

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
                state.config.config.tools.find(
                  (tool) => tool.function.name === toolName,
                ),
              )
              .filter(Boolean)
          : undefined,
      },
    );

    // Stream response
    let next = await gen.next();
    while (!next.done) {
      if (!getState().session.isStreaming) {
        dispatch(abortStream());
        break;
      }

      const update = next.value as ChatMessage;
      dispatch(streamUpdate(update));
      next = await gen.next();

      // There has been lag when streaming tool calls. This is a temporary solution
      if (update.role === "assistant" && update.toolCalls) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    // Attach prompt log
    let returnVal = next.value as PromptLog;
    if (returnVal) {
      dispatch(addPromptCompletionPair([returnVal]));
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
  } catch (e) {
    // If there's an error, we should clear the response so there aren't two input boxes
    dispatch(clearLastEmptyResponse());
  }
});
