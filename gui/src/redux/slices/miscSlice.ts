import { createSlice } from "@reduxjs/toolkit";

export const miscSlice = createSlice({
  name: "misc",
  initialState: {
    takenAction: false,
    serverStatusMessage: "Continue Server Starting",
  },
  reducers: {
    setTakenActionTrue: (state: any, action) => {
      state.takenAction = true;
    },
    setServerStatusMessage: (state: any, action) => {
      state.serverStatusMessage = action.payload;
    },
  },
});

export const { setTakenActionTrue, setServerStatusMessage } = miscSlice.actions;
export default miscSlice.reducer;
