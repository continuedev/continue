import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  defaultOnboardingCardState,
  OnboardingCardState,
} from "../../components/OnboardingCard";

type UIState = {
  showDialog: boolean;
  dialogMessage: string | JSX.Element | undefined;
  dialogEntryOn: boolean;
  onboardingCard: OnboardingCardState;
  shouldAddFileForEditing: boolean;
  ttsActive: boolean;
};

const initialState: UIState = {
  showDialog: false,
  ttsActive: false,
  dialogMessage: "",
  dialogEntryOn: false,
  onboardingCard: defaultOnboardingCardState,
  shouldAddFileForEditing: false,
};

export const uiSlice = createSlice({
  name: "uiState",
  initialState,
  reducers: {
    setOnboardingCard: (
      state,
      action: PayloadAction<Partial<OnboardingCardState>>,
    ) => {
      state.onboardingCard = { ...state.onboardingCard, ...action.payload };
    },
    setDialogMessage: (
      state,
      action: PayloadAction<UIState["dialogMessage"]>,
    ) => {
      state.dialogMessage = action.payload;
    },
    setDialogEntryOn: (
      state,
      action: PayloadAction<UIState["dialogEntryOn"]>,
    ) => {
      state.dialogEntryOn = action.payload;
    },
    setShowDialog: (state, action: PayloadAction<UIState["showDialog"]>) => {
      state.showDialog = action.payload;
    },
    setShouldAddFileForEditing: (
      state,
      action: PayloadAction<UIState["shouldAddFileForEditing"]>,
    ) => {
      state.shouldAddFileForEditing = action.payload;
    },
    setTTSActive: (state, { payload }: PayloadAction<boolean>) => {
      state.ttsActive = payload;
    },
  },
});

export const {
  setOnboardingCard,
  setDialogMessage,
  setDialogEntryOn,
  setShowDialog,
  setShouldAddFileForEditing,
  setTTSActive,
} = uiSlice.actions;

export default uiSlice.reducer;
