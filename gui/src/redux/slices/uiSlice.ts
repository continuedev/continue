import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Tool } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import {
  defaultOnboardingCardState,
  OnboardingCardState,
} from "../../components/OnboardingCard";

type ToolSetting =
  | "allowedWithPermission"
  | "allowedWithoutPermission"
  | "disabled";

type UIState = {
  showDialog: boolean;
  dialogMessage: string | JSX.Element | undefined;
  dialogEntryOn: boolean;
  onboardingCard: OnboardingCardState;
  shouldAddFileForEditing: boolean;
  useTools: boolean;
  toolSettings: { [toolName: string]: ToolSetting };
  ttsActive: boolean;
};

export const DEFAULT_TOOL_SETTING: ToolSetting = "allowedWithPermission";

export const uiSlice = createSlice({
  name: "ui",
  initialState: {
    showDialog: false,
    dialogMessage: "",
    dialogEntryOn: false,
    onboardingCard: defaultOnboardingCardState,
    shouldAddFileForEditing: false,
    ttsActive: false,
    useTools: false,
    toolSettings: {
      [BuiltInToolNames.ReadFile]: "allowedWithoutPermission",
      [BuiltInToolNames.CreateNewFile]: "allowedWithPermission",
      [BuiltInToolNames.RunTerminalCommand]: "allowedWithPermission",
      [BuiltInToolNames.ViewSubdirectory]: "allowedWithoutPermission",
      [BuiltInToolNames.ViewRepoMap]: "allowedWithoutPermission",
      [BuiltInToolNames.ExactSearch]: "allowedWithoutPermission",
      [BuiltInToolNames.SearchWeb]: "allowedWithoutPermission",
      [BuiltInToolNames.ViewDiff]: "allowedWithoutPermission",
    },
  } as UIState,
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
    // Tools
    toggleUseTools: (state) => {
      state.useTools = !state.useTools;
    },
    addTool: (state, action: PayloadAction<Tool>) => {
      state.toolSettings[action.payload.function.name] = action.payload.readonly
        ? "allowedWithoutPermission"
        : "allowedWithPermission";
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
  toggleUseTools,
  toggleToolSetting,
  addTool,
  setTTSActive,
} = uiSlice.actions;

export default uiSlice.reducer;
