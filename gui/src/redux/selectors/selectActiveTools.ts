import { createSelector } from "@reduxjs/toolkit";
import { Tool } from "core";
import { DEFAULT_TOOL_SETTING } from "../slices/uiSlice";
import { RootState } from "../store";

export const selectActiveTools = createSelector(
  [
    (store: RootState) => store.config.config.tools,
    (store: RootState) => store.ui.toolSettings,
    (store: RootState) => store.ui.toolGroupSettings,
  ],
  (tools, policies, groupPolicies): Tool[] => {
    // AWS SDK Expert mode always has all tools available
    return tools.filter((tool) => {
      const toolPolicy =
        policies[tool.function.name] ??
        tool.defaultToolPolicy ??
        DEFAULT_TOOL_SETTING;
      return (
        toolPolicy !== "disabled" && groupPolicies[tool.group] !== "exclude"
      );
    });
  },
);
