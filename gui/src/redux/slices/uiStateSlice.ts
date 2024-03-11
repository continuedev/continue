import { PayloadAction, createSlice } from "@reduxjs/toolkit";
type UiState = {
  bottomMessage: JSX.Element | undefined;
  bottomMessageCloseTimeout: NodeJS.Timeout | undefined;
  displayBottomMessageOnBottom: boolean;
  showDialog: boolean;
  dialogMessage: string | JSX.Element;
  dialogEntryOn: boolean;
};

export const uiStateSlice = createSlice({
  name: "uiState",
  initialState: {
    bottomMessage: undefined,
    bottomMessageCloseTimeout: undefined,
    showDialog: false,
    dialogMessage: "",
    dialogEntryOn: false,
    displayBottomMessageOnBottom: true,
  } as UiState,
  reducers: {
    setBottomMessage: (
      state,
      action: PayloadAction<UiState["bottomMessage"]>
    ) => {
      state.bottomMessage = action.payload;
    },
    setBottomMessageCloseTimeout: (
      state,
      action: PayloadAction<UiState["bottomMessageCloseTimeout"]>
    ) => {
      if (state.bottomMessageCloseTimeout) {
        clearTimeout(state.bottomMessageCloseTimeout);
      }
      state.bottomMessageCloseTimeout = action.payload;
    },
    setDialogMessage: (
      state,
      action: PayloadAction<UiState["dialogMessage"]>
    ) => {
      state.dialogMessage = action.payload;
    },
    setDialogEntryOn: (
      state,
      action: PayloadAction<UiState["dialogEntryOn"]>
    ) => {
      state.dialogEntryOn = action.payload;
    },
    setShowDialog: (state, action: PayloadAction<UiState["showDialog"]>) => {
      state.showDialog = action.payload;
    },
    setDisplayBottomMessageOnBottom: (
      state,
      action: PayloadAction<UiState["displayBottomMessageOnBottom"]>
    ) => {
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
