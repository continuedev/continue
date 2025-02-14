import { createAsyncThunk } from "@reduxjs/toolkit";
import { JSONContent } from "@tiptap/core";
import {
  ContextItemWithId,
  InputModifiers,
  MessageContent,
  RangeInFile,
} from "core";
import * as URI from "uri-js";
import resolveEditorContent from "../../components/mainInput/resolveInput";
import { selectDefaultModel } from "../slices/configSlice";
import { ThunkApiType } from "../store";

export const gatherContext = createAsyncThunk<
  {
    selectedContextItems: ContextItemWithId[];
    selectedCode: RangeInFile[];
    content: MessageContent;
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
    const defaultModel = selectDefaultModel(state);
    const defaultContextProviders =
      state.config.config.experimental?.defaultContext ?? [];

    if (!defaultModel) {
      console.error(
        "gatherContext thunk: Cannot gather context, no model selected",
      );
      throw new Error("No chat model selected");
    }

    // Resolve context providers and construct new history
    let [selectedContextItems, selectedCode, content] =
      await resolveEditorContent({
        editorState,
        modifiers,
        ideMessenger: extra.ideMessenger,
        defaultContextProviders,
        dispatch,
        selectedModelTitle: defaultModel.title,
      });

    // Automatically use currently open file
    if (!modifiers.noContext) {
      const usingFreeTrial = defaultModel?.provider === "free-trial";

      const currentFileResponse = await extra.ideMessenger.request(
        "context/getContextItems",
        {
          name: "currentFile",
          query: "non-mention-usage",
          fullInput: "",
          selectedCode: [],
          selectedModelTitle: defaultModel.title,
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

    if (promptPreamble) {
      if (typeof content === "string") {
        content = promptPreamble + content;
      } else if (content[0].type === "text") {
        content[0].text = promptPreamble + content[0].text;
      }
    }

    // dispatch(addContextItems(contextItems));
    return { selectedContextItems, selectedCode, content };
  },
);
