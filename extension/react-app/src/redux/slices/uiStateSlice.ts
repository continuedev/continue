import { createSlice } from "@reduxjs/toolkit";

export const uiStateSlice = createSlice({
  name: "uiState",
  initialState: {
    bottomMessage: undefined,
    bottomMessageCloseTimeout: undefined,
    showDialog: false,
    dialogMessage: "",
    dialogEntryOn: false,
    displayBottomMessageOnBottom: true,
  },
  reducers: {
    setBottomMessage: (state, action) => {
      state.bottomMessage = action.payload;
    },
    setBottomMessageCloseTimeout: (state, action) => {
      if (state.bottomMessageCloseTimeout) {
        clearTimeout(state.bottomMessageCloseTimeout);
      }
      state.bottomMessageCloseTimeout = action.payload;
    },
    setDialogMessage: (state, action) => {
      state.dialogMessage = action.payload;
    },
    setDialogEntryOn: (state, action) => {
      state.dialogEntryOn = action.payload;
    },
    setShowDialog: (state, action) => {
      state.showDialog = action.payload;
    },
    setDisplayBottomMessageOnBottom: (state, action) => {
      state.displayBottomMessageOnBottom = action.payload;
    },
  },
});

export const {
  setBottomMessage,
  setBottomMessageCloseTimeout,
  setDialogMessage,
  setDialogEntryOn,
  setShowDialog,
  setDisplayBottomMessageOnBottom,
} = uiStateSlice.actions;
export default uiStateSlice.reducer;
