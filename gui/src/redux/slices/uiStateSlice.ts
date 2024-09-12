import { PayloadAction, createSlice } from "@reduxjs/toolkit";
type UiState = {
  showDialog: boolean;
  dialogMessage: string | JSX.Element | undefined;
  dialogEntryOn: boolean;
  nextCodeBlockToApplyIndex: number;
};

export const uiStateSlice = createSlice({
  name: "uiState",
  initialState: {
    showDialog: false,
    dialogMessage: "",
    dialogEntryOn: false,
    nextCodeBlockToApplyIndex: -1,
  } as UiState,
  reducers: {
    setDialogMessage: (
      state,
      action: PayloadAction<UiState["dialogMessage"]>,
    ) => {
      state.dialogMessage = action.payload;
    },
    setDialogEntryOn: (
      state,
      action: PayloadAction<UiState["dialogEntryOn"]>,
    ) => {
      state.dialogEntryOn = action.payload;
    },
    setShowDialog: (state, action: PayloadAction<UiState["showDialog"]>) => {
      state.showDialog = action.payload;
    },
    resetNextCodeBlockToApplyIndex: (state) => {
      state.nextCodeBlockToApplyIndex = -1;
    },
    incrementNextCodeBlockToApplyIndex: (state, action) => {
      state.nextCodeBlockToApplyIndex++;
    },
  },
});

export const {
  setDialogMessage,
  setDialogEntryOn,
  setShowDialog,
  resetNextCodeBlockToApplyIndex,
  incrementNextCodeBlockToApplyIndex,
} = uiStateSlice.actions;
export default uiStateSlice.reducer;
