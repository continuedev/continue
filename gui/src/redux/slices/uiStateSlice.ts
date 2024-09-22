import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  defaultOnboardingCardState,
  OnboardingCardState,
} from "../../components/OnboardingCard";

type UiState = {
  bottomMessage: JSX.Element | undefined;
  bottomMessageCloseTimeout: NodeJS.Timeout | undefined;
  displayBottomMessageOnBottom: boolean;
  showDialog: boolean;
  dialogMessage: string | JSX.Element | undefined;
  dialogEntryOn: boolean;
  nextCodeBlockToApplyIndex: number;
  onboardingCard: OnboardingCardState;
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
    nextCodeBlockToApplyIndex: 0,
    onboardingCard: defaultOnboardingCardState,
  } as UiState,
  reducers: {
    setOnboardingCard: (
      state,
      action: PayloadAction<Partial<OnboardingCardState>>,
    ) => {
      state.onboardingCard = { ...state.onboardingCard, ...action.payload };
    },
    setBottomMessage: (
      state,
      action: PayloadAction<UiState["bottomMessage"]>,
    ) => {
      state.bottomMessage = action.payload;
    },
    setBottomMessageCloseTimeout: (
      state,
      action: PayloadAction<UiState["bottomMessageCloseTimeout"]>,
    ) => {
      if (state.bottomMessageCloseTimeout) {
        clearTimeout(state.bottomMessageCloseTimeout);
      }
      state.bottomMessageCloseTimeout = action.payload;
    },
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
    setDisplayBottomMessageOnBottom: (
      state,
      action: PayloadAction<UiState["displayBottomMessageOnBottom"]>,
    ) => {
      state.displayBottomMessageOnBottom = action.payload;
    },
    resetNextCodeBlockToApplyIndex: (state) => {
      state.nextCodeBlockToApplyIndex = 0;
    },
    incrementNextCodeBlockToApplyIndex: (state, action) => {
      state.nextCodeBlockToApplyIndex++;
    },
  },
});

export const {
  setOnboardingCard,
  setDialogMessage,
  setDialogEntryOn,
  setShowDialog,
  resetNextCodeBlockToApplyIndex,
  incrementNextCodeBlockToApplyIndex,
  setBottomMessage,
  setBottomMessageCloseTimeout,
  setDisplayBottomMessageOnBottom,
} = uiStateSlice.actions;

export default uiStateSlice.reducer;
