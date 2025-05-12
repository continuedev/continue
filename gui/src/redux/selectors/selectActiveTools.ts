import { createSelector } from "@reduxjs/toolkit";
import { Tool } from "core";
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
    }
    else if (mode === "agent") {
      return tools.filter(
        (tool) =>
          policies[tool.function.name] !== "disabled" &&
          groupPolicies[tool.group] !== "exclude",
      );
    }
    else {
      return [];
    }
  },
);
