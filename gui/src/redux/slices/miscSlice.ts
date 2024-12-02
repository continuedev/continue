import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { PackageDocsResult } from "core";

export type MiscState = {
  docsSuggestions: PackageDocsResult[];
  lastControlServerBetaEnabledStatus: boolean;
};

const initialState: MiscState = {
  docsSuggestions: [],
  lastControlServerBetaEnabledStatus: false,
};

export const miscSlice = createSlice({
  name: "misc",
  initialState,
  reducers: {
    setLastControlServerBetaEnabledStatus: (
      state,
      action: PayloadAction<boolean>,
    ) => {
      state.lastControlServerBetaEnabledStatus = action.payload;
    },
    updateDocsSuggestions: (
      state,
      { payload }: PayloadAction<PackageDocsResult[]>,
    ) => {
      state.docsSuggestions = payload;
    },
  },
});

export const { setLastControlServerBetaEnabledStatus, updateDocsSuggestions } =
  miscSlice.actions;

export default miscSlice.reducer;
