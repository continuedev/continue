import { ContextItemWithId } from "core";
import { IIdeMessenger } from "../context/IdeMessenger";
import { updateFileSymbols } from "../redux/slices/stateSlice";
import { Dispatch } from "@reduxjs/toolkit";

export async function updateFileSymbolsFromContextItems(
  contextItems: ContextItemWithId[],
  ideMessenger: IIdeMessenger,
  dispatch: Dispatch,
) {
  // Given a list of context items,
  // Get unique file uris
  try {
    const contextUris = Array.from(
      new Set(
        contextItems
          .filter((item) => item.uri?.type === "file" && item?.uri?.value)
          .map((item) => item.uri.value),
      ),
    );
    // And then update symbols for those files
    if (contextUris.length > 0) {
      const symbolsResult = await ideMessenger.request(
        "context/getSymbolsForFiles",
        { uris: contextUris },
      );
      if (symbolsResult.status === "success") {
        dispatch(updateFileSymbols(symbolsResult.content));
      }
    }
  } catch (e) {
    console.error("Error updating file symbols from context items", e);
  }
}
