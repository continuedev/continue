import type { JSX } from "react";
import { ToolPolicy } from "@continuedev/terminal-security";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { MessageModes, RuleWithSource, Tool } from "core";
import { BUILT_IN_GROUP_NAME } from "core/tools/builtIn";
import type {
  ApprovalCategories,
  ApprovalCategoryName,
  ApprovalModeName,
} from "core/tools/permissions/approval";
import {
  defaultOnboardingCardState,
  OnboardingCardState,
} from "../../components/OnboardingCard";
import { getLocalStorage, LocalStorageKey } from "../../util/localStorage";
import type { PromptCacheSetting } from "../../util/promptCache";

export type RulePolicy = "on" | "off";

export type ToolGroupPolicy = "include" | "exclude";

export type ToolPolicies = { [toolName: string]: ToolPolicy };
export type RulePolicies = { [ruleName: string]: RulePolicy };
export type ToolGroupPolicies = { [toolGroupName: string]: ToolGroupPolicy };
export type ReasoningSettings = { [modelTitle: string]: boolean };
export type PromptCacheSettings = { [modelTitle: string]: PromptCacheSetting };

type UIState = {
  showDialog: boolean;
  dialogMessage: JSX.Element | undefined;
  onboardingCard: OnboardingCardState;
  isExploreDialogOpen: boolean;
  hasDismissedExploreDialog: boolean;
  shouldAddFileForEditing: boolean;
  toolSettings: ToolPolicies;
  toolGroupSettings: ToolGroupPolicies;
  ruleSettings: RulePolicies;
  reasoningSettings: ReasoningSettings;
  /** Prompt cache choice per model title; absent means follow config.yaml. */
  promptCacheSettings: PromptCacheSettings;
  /** Model the user picked by hand per mode; wins over `modeModels` until reload. */
  modeModelOverrides: Partial<Record<MessageModes, string>>;
  ttsActive: boolean;
  /** "auto" needs the experimental flag and a reviewer model; see selectAutoApproval. */
  approvalMode: ApprovalMode;
  /** The Auto-approve switches; used by Auto-approve and Auto modes. */
  approvalCategories: ApprovalCategories;
  /** Per-MCP-server switch, by server name; wins over the global MCP switch. */
  approvalMcpServers: { [serverName: string]: boolean };
};

/**
 * manual: ask as today. autoApprove: the switches allow. auto: the switches,
 * then a reviewer model (experimental). yolo: allow everything that no deny
 * rule, protected path or ask rule stops.
 */
export type ApprovalMode = ApprovalModeName;

export const DEFAULT_APPROVAL_CATEGORIES: ApprovalCategories = {
  readFiles: true,
};

export const DEFAULT_TOOL_SETTING: ToolPolicy = "allowedWithPermission";
export const DEFAULT_RULE_SETTING: RulePolicy = "on";
export const DEFAULT_UI_SLICE: UIState = {
  showDialog: false,
  dialogMessage: undefined,
  onboardingCard: defaultOnboardingCardState,
  isExploreDialogOpen:
    getLocalStorage(LocalStorageKey.IsExploreDialogOpen) ?? false,
  hasDismissedExploreDialog:
    getLocalStorage(LocalStorageKey.HasDismissedExploreDialog) ?? false,
  shouldAddFileForEditing: false,
  ttsActive: false,
  approvalMode: "manual",
  approvalCategories: DEFAULT_APPROVAL_CATEGORIES,
  approvalMcpServers: {},
  toolSettings: {},
  toolGroupSettings: {
    [BUILT_IN_GROUP_NAME]: "include",
  },
  ruleSettings: {},
  reasoningSettings: {},
  promptCacheSettings: {},
  modeModelOverrides: {},
};

export const uiSlice = createSlice({
  name: "ui",
  initialState: DEFAULT_UI_SLICE,
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
    setShowDialog: (state, action: PayloadAction<UIState["showDialog"]>) => {
      state.showDialog = action.payload;
    },
    setIsExploreDialogOpen: (
      state,
      action: PayloadAction<UIState[LocalStorageKey.IsExploreDialogOpen]>,
    ) => {
      state.isExploreDialogOpen = action.payload;
    },
    // Tools
    addTool: (state, action: PayloadAction<Tool>) => {
      state.toolSettings[action.payload.function.name] =
        action.payload.defaultToolPolicy ?? DEFAULT_TOOL_SETTING;
    },
    setToolPolicy: (
      state,
      action: PayloadAction<{
        toolName: string;
        policy: ToolPolicy;
      }>,
    ) => {
      state.toolSettings[action.payload.toolName] = action.payload.policy;
    },
    clearToolPolicy: (state, action: PayloadAction<string>) => {
      delete state.toolSettings[action.payload];
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
    setApprovalMode: (state, { payload }: PayloadAction<ApprovalMode>) => {
      state.approvalMode = payload;
    },
    setApprovalCategory: (
      state,
      {
        payload,
      }: PayloadAction<{ category: ApprovalCategoryName; enabled: boolean }>,
    ) => {
      state.approvalCategories = {
        ...state.approvalCategories,
        [payload.category]: payload.enabled,
      };
    },
    setApprovalMcpServer: (
      state,
      { payload }: PayloadAction<{ server: string; enabled: boolean }>,
    ) => {
      state.approvalMcpServers = {
        ...state.approvalMcpServers,
        [payload.server]: payload.enabled,
      };
    },
    setTTSActive: (state, { payload }: PayloadAction<boolean>) => {
      state.ttsActive = payload;
    },
    setReasoningSetting: (
      state,
      action: PayloadAction<{ modelTitle: string; enabled: boolean }>,
    ) => {
      state.reasoningSettings[action.payload.modelTitle] =
        action.payload.enabled;
    },
    setPromptCacheSetting: (
      state,
      action: PayloadAction<{
        modelTitle: string;
        setting: PromptCacheSetting | undefined;
      }>,
    ) => {
      if (action.payload.setting === undefined) {
        delete state.promptCacheSettings[action.payload.modelTitle];
      } else {
        state.promptCacheSettings[action.payload.modelTitle] =
          action.payload.setting;
      }
    },
    setModeModelOverride: (
      state,
      action: PayloadAction<{ mode: MessageModes; title: string }>,
    ) => {
      state.modeModelOverrides[action.payload.mode] = action.payload.title;
    },
  },
});

export const {
  setOnboardingCard,
  setDialogMessage,
  setShowDialog,
  setIsExploreDialogOpen,
  toggleToolSetting,
  setToolPolicy,
  clearToolPolicy,
  toggleToolGroupSetting,
  addTool,
  addRule,
  toggleRuleSetting,
  setApprovalMode,
  setApprovalCategory,
  setApprovalMcpServer,
  setTTSActive,
  setReasoningSetting,
  setPromptCacheSetting,
  setModeModelOverride,
} = uiSlice.actions;

export default uiSlice.reducer;
