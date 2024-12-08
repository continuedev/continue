import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  ChatMessage,
  ContextItemWithId,
  RangeInFile,
  SlashCommandDescription,
} from "core";
import { selectDefaultModel } from "../slices/configSlice";
import { abortStream, streamUpdate } from "../slices/sessionSlice";
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
    const defaultModel = selectDefaultModel(state);
    const isStreaming = state.session.isStreaming;
    const streamAborter = state.session.streamAborter;

    if (!defaultModel) {
      throw new Error("Default model not defined");
    }

    const modelTitle = defaultModel.title;

    const checkActiveInterval = setInterval(() => {
      if (!isStreaming) {
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
      if (!getState().session.isStreaming) {
        dispatch(abortStream());
        break;
      }
      for (const item of update) {
        if (typeof item === "string") {
          dispatch(
            streamUpdate([
              {
                role: "assistant",
                content: item,
              },
            ]),
          );
        }
      }
    }
    clearInterval(checkActiveInterval);
  },
);
