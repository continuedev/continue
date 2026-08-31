import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const spawnSubagentsTool: Tool = {
  type: "function",
  displayTitle: "Spawn Subagents",
  wouldLikeTo: "delegate work to subagents",
  isCurrently: "running subagents",
  hasAlready: "gathered results from subagents",
  readonly: false,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.SpawnSubagents,
    description: `Delegate one or more self-contained tasks to subagents that run in parallel and report back.

Each subagent works in its own context and returns a single written report. Only that report enters this conversation — none of the files it read, searches it ran, or dead ends it explored do. Use this whenever a task would otherwise flood the conversation with intermediate output.

Good uses:
- Open-ended search across many files ("find every place X is implemented")
- Several independent questions that can be answered at the same time
- Any investigation where you only need the conclusion, not the raw material

Do not use it for:
- A task needing one or two known file reads — just read them
- Work that must happen in a specific order, or where one task needs another's answer first
- Anything requiring back-and-forth: a subagent cannot ask you questions

Write each prompt as if to someone who cannot see this conversation. State the goal, the relevant paths or names, and exactly what the report should contain. Launch independent tasks together in a single call rather than one at a time.`,
    parameters: {
      type: "object",
      properties: {
        tasks: {
          type: "array",
          description:
            "The tasks to run in parallel. Each becomes one subagent.",
          items: {
            type: "object",
            properties: {
              description: {
                type: "string",
                description:
                  "A 3-5 word label for this task, shown to the user (e.g. 'Find auth entrypoints').",
              },
              prompt: {
                type: "string",
                description:
                  "The subagent's complete instructions. It sees only this — no other part of the conversation. Say what to investigate and what its final report must contain.",
              },
              allowed_tools: {
                type: "array",
                description:
                  "Optional. Tool names this subagent may use. Defaults to the read-only tools. Only widen this when the task genuinely requires it.",
                items: { type: "string" },
              },
              model: {
                type: "string",
                description:
                  "Optional. Model to run this subagent on. Defaults to the current chat model.",
              },
            },
            required: ["description", "prompt"],
          },
        },
      },
      required: ["tasks"],
    },
  },
  systemMessageDescription: {
    prefix: `To delegate self-contained work to parallel subagents whose intermediate output never enters this conversation, use the ${BuiltInToolNames.SpawnSubagents} tool with a "tasks" array. Each task needs a short "description" and a fully self-contained "prompt". For example:`,
    exampleArgs: [
      [
        "tasks",
        '[{"description": "Find auth entrypoints", "prompt": "Search the repo for every HTTP route that performs authentication. Report each one as file:line with a one-line summary."}]',
      ],
    ],
  },
  // Spawning is itself inert: it reads nothing and writes nothing. Every tool
  // call a subagent makes is independently gated by the normal policy engine
  // (see agent/authorizeToolCall), which is the real security boundary.
  defaultToolPolicy: "allowedWithoutPermission",
};
