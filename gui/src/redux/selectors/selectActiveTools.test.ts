import type { MessageModes, Tool } from "core";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "core/tools/builtIn";
import { describe, expect, it } from "vitest";
import { getEmptyRootState } from "../../util/test/mockStore";
import { RootState } from "../store";
import { selectActiveTools } from "./selectActiveTools";

function tool(name: string, readonly: boolean, group = BUILT_IN_GROUP_NAME) {
  return {
    type: "function",
    displayTitle: name,
    readonly,
    group,
    function: { name, description: name },
    defaultToolPolicy: "allowedWithoutPermission",
  } as Tool;
}

const tools = [
  tool(BuiltInToolNames.ReadFile, true),
  tool(BuiltInToolNames.EditExistingFile, false),
  tool(BuiltInToolNames.TaskList, true),
  tool(BuiltInToolNames.PresentPlan, true),
];

function names(mode: MessageModes): string[] {
  const state = getEmptyRootState();
  const root: RootState = {
    ...state,
    session: { ...state.session, mode },
    config: { ...state.config, config: { ...state.config.config, tools } },
  };
  return selectActiveTools(root).map((t) => t.function.name);
}

describe("selectActiveTools: present_plan", () => {
  it("is offered in Plan mode, with the read-only tools", () => {
    expect(names("plan")).toEqual([
      BuiltInToolNames.ReadFile,
      BuiltInToolNames.TaskList,
      BuiltInToolNames.PresentPlan,
    ]);
  });

  it("is not offered in Agent or Chat mode", () => {
    expect(names("agent")).not.toContain(BuiltInToolNames.PresentPlan);
    expect(names("agent")).toContain(BuiltInToolNames.EditExistingFile);
    expect(names("chat")).toEqual([]);
  });
});
