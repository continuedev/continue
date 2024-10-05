import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ApplyState } from "core/protocol/ideWebview";
import {
  defaultOnboardingCardState,
  OnboardingCardState,
} from "../../components/OnboardingCard";

type UiState = {
  showDialog: boolean;
  dialogMessage: string | JSX.Element | undefined;
  dialogEntryOn: boolean;
  nextCodeBlockToApplyIndex: number;
  onboardingCard: OnboardingCardState;
  applyStates: ApplyState[];
};

export const uiStateSlice = createSlice({
  name: "uiState",
  initialState: {
    showDialog: false,
    dialogMessage: "",
    dialogEntryOn: false,
    nextCodeBlockToApplyIndex: 0,
    onboardingCard: defaultOnboardingCardState,
    applyStates: [],
  } as UiState,
  reducers: {
    setOnboardingCard: (
      state,
      action: PayloadAction<Partial<OnboardingCardState>>,
    ) => {
      state.onboardingCard = { ...state.onboardingCard, ...action.payload };
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

    resetNextCodeBlockToApplyIndex: (state) => {
      state.nextCodeBlockToApplyIndex = 0;
    },
    incrementNextCodeBlockToApplyIndex: (state, action) => {
      state.nextCodeBlockToApplyIndex++;
    },
    updateApplyState: (state, action: PayloadAction<ApplyState>) => {
      const { streamId, status } = action.payload;
      const index = state.applyStates.findIndex(
        (applyState) => applyState.streamId === streamId,
      );
      if (status === "closed" && index !== -1) {
        state.applyStates.splice(index, 1);
      } else if (index === -1) {
        state.applyStates.push(action.payload);
      } else {
        state.applyStates[index].status = status;
      }
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
  updateApplyState,
} = uiStateSlice.actions;

export default uiStateSlice.reducer;
