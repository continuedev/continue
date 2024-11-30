import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  ChatMessage,
  ContextItemWithId,
  RangeInFile,
  SlashCommandDescription,
} from "core";
import { defaultModelSelector } from "../selectors/modelSelectors";
import { abortStream, streamUpdate } from "../slices/stateSlice";
import { ThunkApiType } from "../store";

export const streamSlashCommand = createAsyncThunk<
  void,
  {
    messages: ChatMessage[];
    slashCommand: SlashCommandDescription;
    input: string;
    historyIndex: number;
    selectedCode: RangeInFile[];
    contextItems: ContextItemWithId[];
  },
  ThunkApiType
>(
  "chat/streamSlashCommand",
  async (
    { messages, selectedCode, slashCommand, input, historyIndex, contextItems },
    { dispatch, getState, extra },
  ) => {
    const state = getState();
    const defaultModel = defaultModelSelector(state);
    const active = state.state.active;
    const streamAborter = state.state.streamAborter;

    if (!defaultModel) {
      throw new Error("Default model not defined");
    }

    const modelTitle = defaultModel.title;

    const checkActiveInterval = setInterval(() => {
      if (!active) {
        dispatch(abortStream());
        clearInterval(checkActiveInterval);
      }
    }, 100);

    for await (const update of extra.ideMessenger.streamRequest(
      "command/run",
      {
        input,
        history: messages,
        modelTitle,
        slashCommandName: slashCommand.name,
        contextItems,
        params: slashCommand.params,
        historyIndex,
        selectedCode,
      },
      streamAborter.signal,
    )) {
      if (!getState().state.active) {
        dispatch(abortStream());
        break;
      }
      if (typeof update === "string") {
        dispatch(streamUpdate(update));
      }
    }
    clearInterval(checkActiveInterval);
  },
);
