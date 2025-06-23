import { createAsyncThunk } from "@reduxjs/toolkit";
import { JSONContent } from "@tiptap/core";
import {
  ContextItemWithId,
  InputModifiers,
  MessageContent,
  RangeInFile,
  SlashCommandDescWithSource,
} from "core";
import * as URI from "uri-js";
import { resolveEditorContent } from "../../components/mainInput/TipTapEditor";
import { selectSelectedChatModel } from "../slices/configSlice";
import { ThunkApiType } from "../store";

export const gatherContext = createAsyncThunk<
  {
    selectedContextItems: ContextItemWithId[];
    selectedCode: RangeInFile[];
    content: MessageContent;
    legacyCommandWithInput:
      | {
          command: SlashCommandDescWithSource;
          input: string;
        }
      | undefined;
  },
  {
    editorState: JSONContent;
    modifiers: InputModifiers;
  },
  ThunkApiType
>(
  "chat/gatherContext",
  async ({ modifiers, editorState }, { dispatch, extra, getState }) => {
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
    const {
      selectedContextItems,
      selectedCode,
      content,
      legacyCommandWithInput,
    } = await resolveEditorContent({
      editorState,
      modifiers,
      ideMessenger: extra.ideMessenger,
      defaultContextProviders,
      availableSlashCommands: state.config.config.slashCommands,
      dispatch,
    });

    // Automatically use currently open file
    if (!modifiers.noContext) {
      const usingFreeTrial = false; // TODO no longer tracking free trial count, need to hook up to hub

      const currentFileResponse = await extra.ideMessenger.request(
        "context/getContextItems",
        {
          name: "currentFile",
          query: "non-mention-usage",
          fullInput: "",
          selectedCode: [],
        },
      );
      if (currentFileResponse.status === "success") {
        const items = currentFileResponse.content;
        if (items.length > 0) {
          const currentFile = items[0];
          const uri = currentFile.uri?.value;

          // don't add the file if it's already in the context items
          if (
            uri &&
            !selectedContextItems.find(
              (item) => item.uri?.value && URI.equal(item.uri.value, uri),
            )
          ) {
            // Limit to 1000 lines if using free trial
            if (usingFreeTrial) {
              currentFile.content = currentFile.content
                .split("\n")
                .slice(0, 1000)
                .join("\n");
              if (!currentFile.content.endsWith("```")) {
                currentFile.content += "\n```";
              }
            }
            currentFile.id = {
              providerTitle: "file",
              itemId: uri,
            };
            selectedContextItems.unshift(currentFile);
          }
        }
      }
    }

    return {
      selectedContextItems,
      selectedCode,
      content,
      legacyCommandWithInput,
    };
  },
);
