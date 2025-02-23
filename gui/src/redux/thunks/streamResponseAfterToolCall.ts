import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { ChatMessage, ContextItem } from "core";
import { constructMessages } from "core/llm/constructMessages";
import { renderContextItems } from "core/util/messageContent";
import { selectDefaultModel } from "../slices/configSlice";
import {
  addContextItemsAtIndex,
  setActive,
  streamUpdate,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { resetStateForNewMessage } from "./resetStateForNewMessage";
import { streamNormalInput } from "./streamNormalInput";
import { streamThunkWrapper } from "./streamThunkWrapper";

export const streamResponseAfterToolCall = createAsyncThunk<
  void,
  {
    toolCallId: string;
    toolOutput: ContextItem[];
  },
  ThunkApiType
>(
  "chat/streamAfterToolCall",
  async ({ toolCallId, toolOutput }, { dispatch, getState }) => {
    await dispatch(
      streamThunkWrapper(async () => {
        const state = getState();
        const useTools = state.ui.useTools;
        const initialHistory = state.session.history;
        const defaultModel = selectDefaultModel(state);

        if (!defaultModel) {
          throw new Error("No model selected");
        }

        resetStateForNewMessage();

        await new Promise((resolve) => setTimeout(resolve, 0));

        const newMessage: ChatMessage = {
          role: "tool",
          content: renderContextItems(toolOutput),
          toolCallId,
        };

        dispatch(streamUpdate([newMessage]));
        dispatch(
          addContextItemsAtIndex({
            index: initialHistory.length,
            contextItems: toolOutput.map((contextItem) => ({
              ...contextItem,
              id: {
                providerTitle: "toolCall",
                itemId: toolCallId,
              },
            })),
          }),
        );

        dispatch(setActive());

        const updatedHistory = getState().session.history;
        const messages = constructMessages(
          [...updatedHistory],
          defaultModel,
          useTools,
        );
        const output = await dispatch(streamNormalInput(messages));
        unwrapResult(output);
      }),
    );
  },
);
