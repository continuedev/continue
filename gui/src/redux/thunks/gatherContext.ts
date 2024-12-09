import { createAsyncThunk } from "@reduxjs/toolkit";
import { JSONContent } from "@tiptap/core";
import {
  ContextItemWithId,
  InputModifiers,
  MessageContent,
  RangeInFile,
} from "core";
import { getBasename, getRelativePath } from "core/util";
import resolveEditorContent, {
  hasSlashCommandOrContextProvider,
} from "../../components/mainInput/resolveInput";
import { ThunkApiType } from "../store";
import { selectDefaultModel } from "../slices/configSlice";
import { setIsGatheringContext } from "../slices/sessionSlice";
import { updateFileSymbolsFromNewContextItems } from "./updateFileSymbols";

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
      console.error("Failed to gather context, no model selected");
      return;
    }

    // Resolve context providers and construct new history
    const shouldGatherContext =
      modifiers.useCodebase || hasSlashCommandOrContextProvider(editorState);

    if (shouldGatherContext) {
      dispatch(setIsGatheringContext(true));
    }

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
          !selectedContextItems.find(
            (item) => item.uri?.value === currentFile.path,
          )
        ) {
          // don't add the file if it's already in the context items
          selectedContextItems.unshift({
            content: `The following file is currently open. Don't reference it if it's not relevant to the user's message.\n\n\`\`\`${getRelativePath(
              currentFile.path,
              await extra.ideMessenger.ide.getWorkspaceDirs(),
            )}\n${currentFileContents}\n\`\`\``,
            name: `Active file: ${getBasename(currentFile.path)}`,
            description: currentFile.path,
            id: {
              itemId: currentFile.path,
              providerTitle: "file",
            },
            uri: {
              type: "file",
              value: currentFile.path,
            },
          });
        }
      }
    }

    dispatch(updateFileSymbolsFromNewContextItems(selectedContextItems));

    if (promptPreamble) {
      if (typeof content === "string") {
        content = promptPreamble + content;
      } else {
        content[0].text = promptPreamble + content[0].text;
      }
    }

    // dispatch(addContextItems(contextItems));
    return { selectedContextItems, selectedCode, content };
  },
);
