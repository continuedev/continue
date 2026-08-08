import { createSelector } from "@reduxjs/toolkit";
import { Tool } from "core";
import { BUILT_IN_GROUP_NAME } from "core/tools/builtIn";
import { DEFAULT_TOOL_SETTING } from "../slices/uiSlice";
import { RootState } from "../store";

export const selectActiveTools = createSelector(
  [
    (store: RootState) => store.session.mode,
    (store: RootState) => store.config.config.tools,
    (store: RootState) => store.ui.toolSettings,
    (store: RootState) => store.ui.toolGroupSettings,
  ],
  (mode, tools, policies, groupPolicies): Tool[] => {
    if (mode === "chat") {
      return [];
    } else {
      const enabledTools = tools.filter((tool) => {
        const toolPolicy =
          policies[tool.function.name] ??
          tool.defaultToolPolicy ??
          DEFAULT_TOOL_SETTING;
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
