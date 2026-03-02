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
    },
  },
  run: async () => "",
};

export const SUBAGENT_PARALLEL_TOOL_META: Tool = {
  name: "SubagentParallel",
  displayName: "Subagent Parallel",
  description:
    "Invoke multiple subagents in parallel to carry out independent tasks.",
  readonly: false,
  isBuiltIn: true,
  parameters: {
    type: "object",
    required: ["tasks"],
    properties: {
      tasks: {
        type: "array",
        description:
          "Array of tasks to execute in parallel. Each task specifies a subagent and its prompt.",
      },
    },
  },
  run: async () => "",
};
