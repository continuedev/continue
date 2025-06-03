import { createAsyncThunk } from "@reduxjs/toolkit";
import { JSONContent } from "@tiptap/core";
import {
  ContextItemWithId,
  InputModifiers,
  MessageContent,
  RangeInFile,
  SlashCommandDescription,
} from "core";
import { resolveEditorContent } from "../../components/mainInput/TipTapEditor/utils";
import { selectSelectedChatModel } from "../slices/configSlice";
import { ThunkApiType } from "../store";

export const gatherContext = createAsyncThunk<
  {
    selectedContextItems: ContextItemWithId[];
    selectedCode: RangeInFile[];
    content: MessageContent;
    slashCommandWithInput:
      | {
          command: SlashCommandDescription;
          input: string;
        }
      | undefined;
  },
  {
    editorState: JSONContent;
    modifiers: InputModifiers;
    promptPreamble?: string;
  },
  ThunkApiType
>(
  "chat/gatherContext",
  async (
    { modifiers, editorState, promptPreamble },
    { dispatch, extra, getState },
  ) => {
    const state = getState();
    const selectedChatModel = selectSelectedChatModel(state);

    const defaultContextProviders =
      state.config.config.experimental?.defaultContext ?? [];

    if (!selectedChatModel) {
      console.error(
        "gatherContext thunk: Cannot gather context, no model selected",
      );
      throw new Error("No chat model selected");
    }

    // Resolve context providers and construct new history
    let [selectedContextItems, selectedCode, content, slashCommandWithInput] =
      await resolveEditorContent({
        editorState,
        modifiers,
        ideMessenger: extra.ideMessenger,
        defaultContextProviders,
        availableSlashCommands: state.config.config.slashCommands,
        dispatch,
      });

    if (promptPreamble) {
      if (typeof content === "string") {
        content = promptPreamble + content;
      } else if (content[0].type === "text") {
        content[0].text = promptPreamble + content[0].text;
      }
    }

    return {
      selectedContextItems,
      selectedCode,
      content,
      slashCommandWithInput,
    };
  },
);
