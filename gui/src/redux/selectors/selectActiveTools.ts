import { createSelector } from "@reduxjs/toolkit";
import { Tool } from "core";
import { RootState } from "../store";
import { CHAT_UNSAFE_TOOLS } from "core/tools/builtIn";

export const selectActiveTools = createSelector(
  [
    (store: RootState) => store.session.mode,
    (store: RootState) => store.config.config.tools,
    (store: RootState) => store.ui.toolSettings,
    (store: RootState) => store.ui.toolGroupSettings,
  ],
  (mode, tools, policies, groupPolicies): Tool[] => {
    if (mode === "chat") {
      const chatSafeTools: Tool[] = tools.filter(
        (tool) =>
          !CHAT_UNSAFE_TOOLS.includes(tool.function.name) &&
          policies[tool.function.name] !== "disabled" &&
          groupPolicies[tool.group] !== "exclude",
      );
      return chatSafeTools;
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
