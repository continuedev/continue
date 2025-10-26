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
    // First filter based on tool policies
    const enabledTools = tools.filter(
      (tool) =>
        policies[tool.function.name] !== "disabled" &&
        groupPolicies[tool.group] !== "exclude",
    );

    // Plan mode: only read-only tools (use the tool's readonly property)
    // This automatically includes all MCP tools marked as readonly
    if (mode === "plan") {
      return enabledTools.filter((tool) => tool.readonly);
    }

    // Agent mode: all enabled tools
    return enabledTools;
  },
);
