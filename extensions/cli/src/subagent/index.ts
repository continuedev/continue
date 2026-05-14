import { Tool } from "../tools/types.js";

export const SUBAGENT_TOOL_META: Tool = {
  name: "Subagent",
  displayName: "Subagent",
  description: "Use a subagent to handle a specialized task.",
  readonly: false,
  isBuiltIn: true,
  parameters: {
    type: "object",
    required: ["description", "prompt", "subagent_name"],
    properties: {
      description: {
        type: "string",
        description: "A short description of the task",
      },
      prompt: {
        type: "string",
        description: "The task for the agent to perform",
      },
      subagent_name: {
        type: "string",
        description: "The type of specialized agent to use for this task.",
      },
      profile: {
        type: "string",
        description:
          "Optional execution profile for the subagent. Use 'explore' for reconnaissance, 'verify' for review/validation, or 'coordinator-worker' when the worker should participate in a shared coordinator scratchpad.",
        enum: ["explore", "verify", "coordinator-worker"],
      },
      teammate_name: {
        type: "string",
        description:
          "Optional teammate name when this subagent run should be recorded as part of an active team.",
      },
      team_name: {
        type: "string",
        description:
          "Optional active team name when delegating this subagent run inside a created team.",
      },
      backend: {
        type: "string",
        description:
          "Optional execution backend. Use 'in-process' for the existing inline worker, 'process' for a persistent background worker, or 'tmux' for a tmux swarm pane.",
        enum: ["in-process", "process", "tmux"],
      },
    },
  },
  run: async () => "",
};
