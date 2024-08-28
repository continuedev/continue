import { PayloadAction, createSlice } from "@reduxjs/toolkit";

export const miscSlice = createSlice({
  name: "misc",
  initialState: {
    takenAction: false,
    serverStatusMessage: "Continue Server Starting",
    lastControlServerBetaEnabledStatus: false,
  },
  reducers: {
    setTakenActionTrue: (state) => {
      state.takenAction = true;
    },
    setServerStatusMessage: (state, action: PayloadAction<string>) => {
      state.serverStatusMessage = action.payload;
    },
    setLastControlServerBetaEnabledStatus: (
      state,
      action: PayloadAction<boolean>,
    ) => {
      state.lastControlServerBetaEnabledStatus = action.payload;
    },
  },
});

export const {
  setTakenActionTrue,
  setServerStatusMessage,
  setLastControlServerBetaEnabledStatus,
} = miscSlice.actions;
export default miscSlice.reducer;
