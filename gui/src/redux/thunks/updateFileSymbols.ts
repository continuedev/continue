import { createAsyncThunk } from "@reduxjs/toolkit";
import { ChatHistoryItem, ContextItemWithId } from "core";
import { CodeBlock } from "../../components/mainInput/TipTapEditor/extensions";
import { updateFileSymbols } from "../slices/sessionSlice";
import { ThunkApiType } from "../store";

export function getContextItemsFromHistory(
  historyItems: ChatHistoryItem[],
  priorToIndex?: number,
) {
  const pastHistoryItems = historyItems.filter(
    (_, i) => i <= (priorToIndex ?? historyItems.length - 1),
  );

  const pastNormalContextItems = pastHistoryItems.flatMap((item) => {
    return (
      item.contextItems?.filter(
        (item) => item.uri?.type === "file" && item.uri?.value,
      ) ?? []
    );
  });
  const pastToolbarContextItems: ContextItemWithId[] = pastHistoryItems
    .filter(
      (item) => item.editorState && Array.isArray(item.editorState.content),
    )
    .flatMap((item) => item.editorState.content)
    .filter(
      (content) =>
        content?.type === CodeBlock.name &&
        content?.attrs?.item?.uri?.value &&
        content.attrs.item.uri?.type === "file",
    )
    .map((content) => content.attrs!.item!);

  return [...pastNormalContextItems, ...pastToolbarContextItems];
}

/*
    Get file symbols for given context items
    Overwrite symbols for existing file matches
*/
export const updateFileSymbolsFromFiles = createAsyncThunk<
  void,
  string[],
  ThunkApiType
>(
  "symbols/updateFromContextItems",
  async (filepaths, { dispatch, extra, getState }) => {
    try {
      // Get unique file uris from context items
      const uniqueUris = Array.from(new Set(filepaths));

      // Update symbols for those files
      if (uniqueUris.length > 0) {
        const result = await extra.ideMessenger.request(
          "context/getSymbolsForFiles",
          { uris: uniqueUris },
        );
        if (result.status === "error") {
          throw new Error(result.error);
        }
        dispatch(updateFileSymbols(result.content));
      }
    } catch (e) {
      console.error("Error updating file symbols from filepaths", e, filepaths);
    }
  },
);

/*
    - Update file symbols for all context items in history
    - That don't already have symbols
*/
export const updateFileSymbolsFromHistory = createAsyncThunk<
  void,
  undefined,
  ThunkApiType
>("symbols/updateFromHistory", async (_, { dispatch, extra, getState }) => {
  try {
    const state = getState();

    // Get unique context item file uris from all history
    const contextItems = getContextItemsFromHistory(state.session.history);

    const uniqueUris = new Set(
      contextItems
        .filter((item) => item?.uri?.type === "file" && item?.uri?.value)
        .map((item) => item.uri!.value),
    );

    // Remove if already in symbols
    Object.keys(state.session.symbols).forEach((key) => {
      uniqueUris.delete(key);
    });

    const uriArray = Array.from(uniqueUris);

    // And then update symbols for those files
    if (uriArray.length > 0) {
      const result = await extra.ideMessenger.request(
        "context/getSymbolsForFiles",
        { uris: uriArray },
      );
      if (result.status === "error") {
        throw new Error(result.error);
      }
      dispatch(updateFileSymbols(result.content));
    }
  } catch (e) {
    // Catch all - don't want file symbols to break the chat experience for now
    console.error("Error updating file symbols from context items", e);
  }
});
