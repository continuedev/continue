import { createAsyncThunk } from "@reduxjs/toolkit";
import { ChatMessage, ContextItem } from "core";
import { constructMessages } from "core/llm/constructMessages";
import { renderContextItems } from "core/util/messageContent";
import { defaultModelSelector } from "../selectors/modelSelectors";
import {
  acceptToolCall,
  addContextItemsAtIndex,
  setActive,
  streamUpdate,
} from "../slices/stateSlice";
import { ThunkApiType } from "../store";
import { handleErrors } from "./handleErrors";
import { resetStateForNewMessage } from "./resetStateForNewMessage";
import { streamNormalInput } from "./streamNormalInput";

export const streamResponseAfterToolCall = createAsyncThunk<
  void,
  {
    toolCallId: string;
    toolOutput: ContextItem[];
  },
  ThunkApiType
>(
  "chat/streamAfterToolCall",
  async ({ toolCallId, toolOutput }, { dispatch, getState, extra }) => {
    await dispatch(
      handleErrors(async () => {
        const state = getState();
        const initialHistory = state.state.history;
        const defaultModel = defaultModelSelector(state);

        resetStateForNewMessage();

        dispatch(acceptToolCall());
        await new Promise((resolve) => setTimeout(resolve, 0));

        const newMessage: ChatMessage = {
          role: "tool",
          content: renderContextItems(toolOutput),
          toolCallId,
        };

        dispatch(streamUpdate(newMessage));
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

        const updatedHistory = getState().state.history;
        const messages = constructMessages(
          [
            ...updatedHistory,
            {
              message: newMessage,
              contextItems: [],
            },
          ],
          defaultModel.model,
        );
        await dispatch(streamNormalInput(messages));
      }),
    );
  },
);
