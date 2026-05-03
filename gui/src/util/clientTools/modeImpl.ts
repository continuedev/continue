import { ContextItem } from "core";
import { setMode } from "../../redux/slices/sessionSlice";
import { ClientToolImpl } from "./callClientTool";

function result(content: string): ContextItem[] {
  return [
    {
      name: "Mode updated",
      description: "Conversation mode change",
      content,
    },
  ];
}

export const enterPlanModeToolImpl: ClientToolImpl = async (
  _args,
  _toolCallId,
  extras,
) => {
  const currentMode = extras.getState().session.mode;
  if (currentMode !== "plan") {
    extras.dispatch(setMode("plan"));
  }

  return {
    respondImmediately: true,
    output: result(
      currentMode === "plan"
        ? "Already in plan mode. Continue exploring and refining the plan with read-only tools."
        : "Switched to plan mode. Use read-only tools to investigate, clarify requirements, and produce a plan before implementation.",
    ),
  };
};

export const exitPlanModeToolImpl: ClientToolImpl = async (
  _args,
  _toolCallId,
  extras,
) => {
  const currentMode = extras.getState().session.mode;
  if (currentMode !== "agent") {
    extras.dispatch(setMode("agent"));
  }

  return {
    respondImmediately: true,
    output: result(
      currentMode === "agent"
        ? "Already in agent mode. You can proceed with implementation."
        : "Exited plan mode and switched to agent mode. You can now implement the approved plan.",
    ),
  };
};