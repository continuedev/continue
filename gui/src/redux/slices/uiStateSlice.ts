import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { BuiltInToolNames } from "core/tools/builtIn";
import {
  defaultOnboardingCardState,
  OnboardingCardState,
} from "../../components/OnboardingCard";

type ToolSetting =
  | "allowedWithPermission"
  | "allowedWithoutPermission"
  | "disabled";

type UiState = {
  showDialog: boolean;
  dialogMessage: string | JSX.Element | undefined;
  dialogEntryOn: boolean;
  onboardingCard: OnboardingCardState;
  shouldAddFileForEditing: boolean;
  useTools: boolean;
  toolSettings: { [toolName: string]: ToolSetting };
};

export const DEFAULT_TOOL_SETTING: ToolSetting = "allowedWithPermission";

export const uiStateSlice = createSlice({
  name: "uiState",
  initialState: {
    showDialog: false,
    dialogMessage: "",
    dialogEntryOn: false,
    onboardingCard: defaultOnboardingCardState,
    shouldAddFileForEditing: false,

    useTools: false,
    toolSettings: {
      [BuiltInToolNames.CreateNewFile]: "allowedWithPermission",
      [BuiltInToolNames.RunTerminalCommand]: "allowedWithPermission",
      [BuiltInToolNames.ViewSubdirectory]: "allowedWithoutPermission",
      [BuiltInToolNames.ViewRepoMap]: "allowedWithoutPermission",
      [BuiltInToolNames.ExactSearch]: "allowedWithoutPermission",
      [BuiltInToolNames.SearchWeb]: "allowedWithoutPermission",
      [BuiltInToolNames.ViewDiff]: "allowedWithoutPermission",
    },
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
    // Tools
    toggleUseTools: (state) => {
      state.useTools = !state.useTools;
    },
    toggleToolSetting: (state, action: PayloadAction<string>) => {
      const setting = state.toolSettings[action.payload];

      switch (setting) {
        case "allowedWithPermission":
          state.toolSettings[action.payload] = "allowedWithoutPermission";
          break;
        case "allowedWithoutPermission":
          state.toolSettings[action.payload] = "disabled";
          break;
        case "disabled":
          state.toolSettings[action.payload] = "allowedWithPermission";
          break;
        default:
          state.toolSettings[action.payload] = DEFAULT_TOOL_SETTING;
          break;
      }
    },
  },
});

export const {
  setOnboardingCard,
  setDialogMessage,
  setDialogEntryOn,
  setShowDialog,
  toggleUseTools,
  toggleToolSetting,
} = uiStateSlice.actions;

export default uiStateSlice.reducer;
