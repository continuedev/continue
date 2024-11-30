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
import { updateFileSymbolsFromContextItems } from "../../util/symbols";
import { defaultModelSelector } from "../selectors/modelSelectors";
import { setIsGatheringContext } from "../slices/stateSlice";
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
    const defaultModel = defaultModelSelector(state);
    const defaultContextProviders =
      state.state.config.experimental?.defaultContext ?? [];

    // Resolve context providers and construct new history
    const shouldGatherContext =
      modifiers.useCodebase || hasSlashCommandOrContextProvider(editorState);

    if (shouldGatherContext) {
      dispatch(
        setIsGatheringContext({
          isGathering: true,
          gatheringMessage: "Gathering Context",
        }),
      );
    }

    let [selectedContextItems, selectedCode, content] =
      await resolveEditorContent(
        editorState,
        modifiers,
        extra.ideMessenger,
        defaultContextProviders,
        dispatch,
      );

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

    await updateFileSymbolsFromContextItems(
      selectedContextItems,
      extra.ideMessenger,
      dispatch,
    );

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
