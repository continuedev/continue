import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { PackageDocsResult } from "core";

export type MiscState = {
  lastControlServerBetaEnabledStatus: boolean;
};

const initialState: MiscState = {
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
    }
  },
});

export const { setLastControlServerBetaEnabledStatus } = miscSlice.actions;

export default miscSlice.reducer;
