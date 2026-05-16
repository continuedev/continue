import { createSelector } from "@reduxjs/toolkit";
import { Tool } from "core";
import { BUILT_IN_GROUP_NAME } from "core/tools/builtIn";
import { DEFAULT_TOOL_SETTING } from "../slices/uiSlice";
import { RootState } from "../store";
import { applyQuickPermissionModeToToolPolicy } from "../util/quickPermissionMode";

export const selectActiveTools = createSelector(
  [
    (store: RootState) => store.session.mode,
    (store: RootState) => store.config.config.tools,
    (store: RootState) => store.ui.toolSettings,
    (store: RootState) => store.ui.toolGroupSettings,
    (store: RootState) => store.ui.quickPermissionMode,
  ],
  (mode, tools, policies, groupPolicies, quickPermissionMode): Tool[] => {
    if (mode === "chat") {
      return [];
    } else {
      const enabledTools = tools.filter((tool) => {
        const baseToolPolicy =
          policies[tool.function.name] ??
          tool.defaultToolPolicy ??
          DEFAULT_TOOL_SETTING;
        const toolPolicy = applyQuickPermissionModeToToolPolicy(
          baseToolPolicy,
          tool,
          quickPermissionMode,
        );
        return (
          toolPolicy !== "disabled" && groupPolicies[tool.group] !== "exclude"
        );
      });
      if (mode === "plan") {
        return enabledTools.filter(
          (t) => t.group !== BUILT_IN_GROUP_NAME || t.readonly,
        );
      }
      return enabledTools;
    }
  },
);
