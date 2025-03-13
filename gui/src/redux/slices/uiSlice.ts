import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Tool } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import {
  defaultOnboardingCardState,
  OnboardingCardState,
} from "../../components/OnboardingCard";
import { getLocalStorage, LocalStorageKey } from "../../util/localStorage";

type ToolSetting =
  | "allowedWithPermission"
  | "allowedWithoutPermission"
  | "disabled";

type UIState = {
  showDialog: boolean;
  dialogMessage: string | JSX.Element | undefined;
  dialogEntryOn: boolean;
  onboardingCard: OnboardingCardState;
  isExploreDialogOpen: boolean;
  hasDismissedExploreDialog: boolean;
  shouldAddFileForEditing: boolean;
  useTools: boolean;
  useThinking: boolean; // New toggle for thinking
  thinkingSettings: {
    // Settings for different providers
    anthropic: {
      budgetTokens: number; // Min 1024, max is below maxTokens
    };
    openai: {
      reasoningEffort: "low" | "medium" | "high";
    };
  };
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
    isExploreDialogOpen: getLocalStorage(LocalStorageKey.IsExploreDialogOpen),
    hasDismissedExploreDialog: getLocalStorage(
      LocalStorageKey.HasDismissedExploreDialog,
    ),
    shouldAddFileForEditing: false,
    ttsActive: false,
    useTools: false,
    useThinking: false,
    thinkingSettings: {
      anthropic: {
        budgetTokens: 4096, // Default reasonable value (half of typical 8K max)
      },
      openai: {
        reasoningEffort: "medium", // Default value
      },
    },
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
    setIsExploreDialogOpen: (
      state,
      action: PayloadAction<UIState[LocalStorageKey.IsExploreDialogOpen]>,
    ) => {
      state.isExploreDialogOpen = action.payload;
    },
    setHasDismissedExploreDialog: (state, action: PayloadAction<boolean>) => {
      state.hasDismissedExploreDialog = action.payload;
    },
    // Tools
    toggleUseTools: (state) => {
      state.useTools = !state.useTools;
    },
    addTool: (state, action: PayloadAction<Tool>) => {
      state.toolSettings[action.payload.function.name] =
        "allowedWithPermission";
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
    // Thinking Controls
    toggleUseThinking: (state) => {
      state.useThinking = !state.useThinking;
    },
    setAnthropicBudgetTokens: (state, action: PayloadAction<number>) => {
      state.useThinking = true;
      state.thinkingSettings.anthropic.budgetTokens = action.payload;
    },
    setOpenAIReasoningEffort: (
      state,
      action: PayloadAction<"low" | "medium" | "high">,
    ) => {
      state.useThinking = true;
      state.thinkingSettings.openai.reasoningEffort = action.payload;
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
  setIsExploreDialogOpen,
  setHasDismissedExploreDialog,
  toggleUseTools,
  toggleToolSetting,
  addTool,
  toggleUseThinking,
  setAnthropicBudgetTokens,
  setOpenAIReasoningEffort,
  setTTSActive,
} = uiSlice.actions;

export default uiSlice.reducer;
