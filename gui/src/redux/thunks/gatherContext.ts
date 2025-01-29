import { createAsyncThunk } from "@reduxjs/toolkit";
import { JSONContent } from "@tiptap/core";
import {
  ContextItemWithId,
  InputModifiers,
  MessageContent,
  RangeInFile,
} from "core";
import resolveEditorContent from "../../components/mainInput/resolveInput";
import { ThunkApiType } from "../store";
import { selectDefaultModel } from "../slices/configSlice";
import { findUriInDirs, getUriPathBasename } from "core/util/uri";
import * as URI from "uri-js";

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

    if (!state.config.defaultModelTitle) {
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
        selectedModelTitle: state.config.defaultModelTitle,
      });

    // Automatically use currently open file
    if (!modifiers.noContext) {
      const usingFreeTrial = defaultModel?.provider === "free-trial";

      const currentFile = await extra.ideMessenger.ide.getCurrentFile();
      if (currentFile) {
        let currentFileContents = currentFile.contents;
        if (usingFreeTrial) {
          currentFileContents = currentFile.contents
            .split("\n")
            .slice(0, 1000)
            .join("\n");
        }
        if (
          // don't add the file if it's already in the context items
          !selectedContextItems.find((item) =>
            URI.equal(item.uri?.value ?? "", currentFile.path),
          )
        ) {
          const { relativePathOrBasename, uri } = findUriInDirs(
            currentFile.path,
            await extra.ideMessenger.ide.getWorkspaceDirs(),
          );
          const basename = getUriPathBasename(currentFile.path);
          selectedContextItems.unshift({
            content: `The following file is currently open. Don't reference it if it's not relevant to the user's message.\n\n\`\`\`${relativePathOrBasename}\n${currentFileContents}\n\`\`\``,
            name: `Active file: ${basename}`,
            description: relativePathOrBasename,
            id: {
              itemId: uri,
              providerTitle: "file",
            },
            uri: {
              type: "file",
              value: uri,
            },
          });
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
