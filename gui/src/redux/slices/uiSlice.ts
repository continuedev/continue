import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RuleWithSource, Tool } from "core";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "core/tools/builtIn";
import {
  defaultOnboardingCardState,
  OnboardingCardState,
} from "../../components/OnboardingCard";
import { getLocalStorage, LocalStorageKey } from "../../util/localStorage";

export type ToolPolicy =
  | "allowedWithPermission"
  | "allowedWithoutPermission"
  | "disabled";

export type RulePolicy = "on" | "off";

export type ToolGroupPolicy = "include" | "exclude";

export type ToolPolicies = { [toolName: string]: ToolPolicy };
export type RulePolicies = { [ruleName: string]: RulePolicy };
export type ToolGroupPolicies = { [toolGroupName: string]: ToolGroupPolicy };

type UIState = {
  showDialog: boolean;
  dialogMessage: string | JSX.Element | undefined;
  dialogEntryOn: boolean;
  onboardingCard: OnboardingCardState;
  isExploreDialogOpen: boolean;
  hasDismissedExploreDialog: boolean;
  shouldAddFileForEditing: boolean;
  toolSettings: ToolPolicies;
  toolGroupSettings: ToolGroupPolicies;
  ruleSettings: RulePolicies;
  ttsActive: boolean;
};

export const DEFAULT_TOOL_SETTING: ToolPolicy = "allowedWithPermission";
export const DEFAULT_RULE_SETTING: RulePolicy = "on";

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
    toolSettings: {
      [BuiltInToolNames.ReadFile]: "allowedWithoutPermission",
      [BuiltInToolNames.EditExistingFile]: "allowedWithPermission",
      [BuiltInToolNames.CreateNewFile]: "allowedWithPermission",
      [BuiltInToolNames.RunTerminalCommand]: "allowedWithPermission",
      [BuiltInToolNames.GrepSearch]: "allowedWithoutPermission",
      [BuiltInToolNames.FileGlobSearch]: "allowedWithoutPermission",
      [BuiltInToolNames.SearchWeb]: "allowedWithoutPermission",
      [BuiltInToolNames.FetchUrlContent]: "allowedWithPermission",
      [BuiltInToolNames.ViewDiff]: "allowedWithoutPermission",
      [BuiltInToolNames.LSTool]: "allowedWithoutPermission",
      [BuiltInToolNames.CreateRuleBlock]: "allowedWithPermission",
      [BuiltInToolNames.RequestRule]: "disabled",
    },
    toolGroupSettings: {
      [BUILT_IN_GROUP_NAME]: "include",
    },
    ruleSettings: {},
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
    toggleToolGroupSetting: (state, action: PayloadAction<string>) => {
      const setting = state.toolGroupSettings[action.payload] ?? "include";

      if (setting === "include") {
        state.toolGroupSettings[action.payload] = "exclude";
      } else {
        state.toolGroupSettings[action.payload] = "include";
      }
    },
    // Rules
    addRule: (state, action: PayloadAction<RuleWithSource>) => {
      state.ruleSettings[action.payload.name!] = DEFAULT_RULE_SETTING;
    },
    toggleRuleSetting: (state, action: PayloadAction<string>) => {
      const setting = state.ruleSettings[action.payload];

      switch (setting) {
        case "on":
          state.ruleSettings[action.payload] = "off";
          break;
        case "off":
          state.ruleSettings[action.payload] = "on";
          break;
        default:
          state.ruleSettings[action.payload] = DEFAULT_RULE_SETTING;
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
  setIsExploreDialogOpen,
  setHasDismissedExploreDialog,
  toggleToolSetting,
  toggleToolGroupSetting,
  addTool,
  addRule,
  toggleRuleSetting,
  setTTSActive,
} = uiSlice.actions;

export default uiSlice.reducer;
