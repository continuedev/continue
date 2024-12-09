import { createAsyncThunk } from "@reduxjs/toolkit";
import { ThunkApiType } from "../store";
import { updateFileSymbols } from "../slices/sessionSlice";
import { ContextItemWithId } from "core";

/*
    Get file symbols for given context items
    Overwrite symbols for existing file matches
*/
export const updateFileSymbolsFromNewContextItems = createAsyncThunk<
  void,
  ContextItemWithId[],
  ThunkApiType
>(
  "symbols/updateFromContextItems",
  async (contextItems, { dispatch, extra, getState }) => {
    try {
      // Get unique file uris from context items
      const uniqueUris = Array.from(
        new Set(
          contextItems
            .filter((item) => item.uri?.type === "file" && item?.uri?.value)
            .map((item) => item.uri!.value),
        ),
      );

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
      console.error(
        "Error updating file symbols from context items",
        e,
        contextItems,
      );
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
    const contextItems = state.session.history.flatMap(
      (item) => item.contextItems,
    );
    const uniqueUris = new Set(
      contextItems
        .filter((item) => item.uri?.type === "file" && item?.uri?.value)
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
