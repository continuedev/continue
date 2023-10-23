import { createSlice } from "@reduxjs/toolkit";

export const miscSlice = createSlice({
  name: "misc",
  initialState: {
    highlightedCode: "",
    takenAction: false,
    serverStatusMessage: "Continue Server Starting",
  },
  reducers: {
    setHighlightedCode: (state: any, action) => {
      state.highlightedCode = action.payload;
    },
    setTakenActionTrue: (state: any, action) => {
      state.takenAction = true;
    },
    setServerStatusMessage: (state: any, action) => {
      state.serverStatusMessage = action.payload;
    },
  },
});

export const {
  setHighlightedCode,
  setTakenActionTrue,
  setServerStatusMessage,
} = miscSlice.actions;
export default miscSlice.reducer;
