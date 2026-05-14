import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const subagentTool: Tool = {
  type: "function",
  displayTitle: "Subagent",
  wouldLikeTo: "launch subagent {{{ subagent_name }}}",
  isCurrently: "running a subagent",
  hasAlready: "ran a subagent",
  readonly: false,
  isInstant: false,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.Subagent,
    description:
      "Launch a specialized subagent to handle a focused task. Use this for decomposing open-ended work or parallelizing a well-scoped investigation. `subagent_name` should match one of the configured subagent models. If omitted, the default selected subagent model is used.",
    parameters: {
      type: "object",
      required: ["prompt"],
      properties: {
        description: {
          type: "string",
          description: "Short task label for the subagent run.",
        },
        prompt: {
          type: "string",
          description: "The full task for the subagent to perform.",
        },
        subagent_name: {
          type: "string",
          description:
            "Optional configured subagent model name/title to use. Falls back to the selected subagent model.",
        },
        team_name: {
          type: "string",
          description:
            "Optional team name for session-scoped teammate coordination. Defaults to the active session team when one exists.",
        },
        teammate_name: {
          type: "string",
          description:
            "Optional teammate identity to record for this subagent run. Defaults to the selected subagent name when running in a team.",
        },
        backend: {
          type: "string",
          description:
            "Optional execution backend. Use 'in-process' (default) for inline execution, or 'process'/'tmux' when a host-provided swarm backend is available.",
          enum: ["in-process", "process", "tmux"],
        },
        profile: {
          type: "string",
          description:
            "Optional execution profile. Use 'coordinator-worker' when the worker should participate in a shared coordinator scratchpad.",
          enum: ["explore", "verify", "coordinator-worker"],
        },
        maxTurns: {
          type: "number",
          description:
            "Optional maximum autonomous turns for the subagent. Defaults to 25.",
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithPermission",
  systemMessageDescription: {
    prefix: `To run a focused nested agent, use the ${BuiltInToolNames.Subagent} tool. For example:`,
    exampleArgs: [
      ["description", "Explore auth flow"],
      [
        "prompt",
        "Trace the authentication flow from login form to token storage and summarize the owning files.",
      ],
      ["subagent_name", "Explore"],
      ["team_name", "Coordination"],
      ["teammate_name", "investigator"],
      ["backend", "in-process"],
      ["profile", "coordinator-worker"],
    ],
  },
  toolCallIcon: "Squares2X2Icon",
};
