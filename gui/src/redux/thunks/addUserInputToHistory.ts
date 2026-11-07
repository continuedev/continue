import { JSONContent } from "@tiptap/core";
import { InputModifiers } from "core";
import { v4 as uuidv4 } from "uuid";

import { resolveEditorContent } from "../../components/mainInput/TipTapEditor/utils/resolveEditorContent";
import { IIdeMessenger } from "../../context/IdeMessenger";
import {
  resetNextCodeBlockToApplyIndex,
  submitEditorAndInitAtIndex,
  updateHistoryItemAtIndex,
} from "../slices/sessionSlice";
import { AppThunkDispatch, RootState } from "../store";
import { updateFileSymbolsFromFiles } from "./updateFileSymbols";

/**
 * Put the person's input into the history at `index` as a user message, with
 * its @-mentions and default context resolved. Used for a new message and for
 * queued messages delivered at a tool boundary (steering).
 */
export async function addUserInputToHistory({
  editorState,
  modifiers,
  index,
  dispatch,
  getState,
  ideMessenger,
}: {
  editorState: JSONContent;
  modifiers: InputModifiers;
  index: number;
  dispatch: AppThunkDispatch;
  getState: () => RootState;
  ideMessenger: IIdeMessenger;
}) {
  const state = getState();
  dispatch(submitEditorAndInitAtIndex({ index, editorState }));
  dispatch(resetNextCodeBlockToApplyIndex());

  const defaultContextProviders =
    state.config.config.experimental?.defaultContext ?? [];

  // Resolve context providers and construct new history
  const resolved = await resolveEditorContent({
    editorState,
    modifiers,
    ideMessenger,
    defaultContextProviders,
    availableSlashCommands: state.config.config.slashCommands,
    dispatch,
    getState,
  });
  const { selectedContextItems, selectedCode, content } = resolved;

  // symbols for both context items AND selected codeblocks
  const filesForSymbols = [
    ...selectedContextItems
      .filter((item) => item.uri?.type === "file" && item?.uri?.value)
      .map((item) => item.uri!.value),
    ...selectedCode.map((rif) => rif.filepath),
  ];
  void dispatch(updateFileSymbolsFromFiles(filesForSymbols));

  dispatch(
    updateHistoryItemAtIndex({
      index,
      updates: {
        message: {
          role: "user",
          content,
          id: uuidv4(),
        },
        contextItems: selectedContextItems,
      },
    }),
  );

  return resolved;
}
