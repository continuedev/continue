import { createSelector } from "@reduxjs/toolkit";
import { Tool } from "core";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "core/tools/builtIn";
import { DEFAULT_TOOL_SETTING } from "../slices/uiSlice";
import { RootState } from "../store";

const byName = (a: Tool, b: Tool) =>
  a.function.name < b.function.name
    ? -1
    : a.function.name > b.function.name
      ? 1
      : 0;

/**
 * Built-in tools in their own fixed order, then the rest by name. MCP
 * servers connect in no fixed order and a reconnected server's tools move to
 * the end; the tool list comes before the conversation in every request, so
 * a reordered list makes a local server's prompt cache read the whole
 * conversation again.
 */
function stableToolOrder(tools: Tool[]): Tool[] {
  return [
    ...tools.filter((t) => t.group === BUILT_IN_GROUP_NAME),
    ...tools.filter((t) => t.group !== BUILT_IN_GROUP_NAME).sort(byName),
  ];
}

export const selectActiveTools = createSelector(
  [
    (store: RootState) => store.session.mode,
    (store: RootState) => store.config.config.tools,
    (store: RootState) => store.ui.toolSettings,
    (store: RootState) => store.ui.toolGroupSettings,
    // Loop mode: an item is running (its two tools, and the loop owns the list)
    (store: RootState) => store.session.loop?.current?.kind === "item",
    (store: RootState) => !!store.session.taskPlan?.items.length,
  ],
  (
    mode,
    tools,
    policies,
    groupPolicies,
    loopItemRunning,
    hasTaskList,
  ): Tool[] => {
    if (mode === "chat") {
      return [];
    } else {
      const enabledTools = tools.filter((tool) => {
        // Only Plan mode makes a list. Agent mode acts: it gets the tool only
        // to keep a list a plan left. While the loop runs an item, the loop
        // keeps the list.
        if (
          tool.function.name === BuiltInToolNames.TaskList &&
          mode !== "plan" &&
          !(mode === "agent" && hasTaskList && !loopItemRunning)
        ) {
          return false;
        }
        // Loop mode's tools exist only for the item it is running.
        if (
          (tool.function.name === BuiltInToolNames.HoldQuestion ||
            tool.function.name === BuiltInToolNames.FinishItem ||
            tool.function.name === BuiltInToolNames.RemindMe) &&
          !(loopItemRunning && mode === "agent")
        ) {
          return false;
        }
        // Presenting a plan is how Plan mode ends: Plan mode only.
        if (
          tool.function.name === BuiltInToolNames.PresentPlan &&
          mode !== "plan"
        ) {
          return false;
        }
        const toolPolicy =
          policies[tool.function.name] ??
          tool.defaultToolPolicy ??
          DEFAULT_TOOL_SETTING;
        return (
          toolPolicy !== "disabled" && groupPolicies[tool.group] !== "exclude"
        );
      });
      if (mode === "plan") {
        return stableToolOrder(
          enabledTools.filter(
            (t) => t.group !== BUILT_IN_GROUP_NAME || t.readonly,
          ),
        );
      }
      return stableToolOrder(enabledTools);
    }
  },
);
