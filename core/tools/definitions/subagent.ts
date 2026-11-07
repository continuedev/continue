import { GetTool, Tool } from "../..";
import {
  BUILT_IN_SUBAGENTS,
  type SubagentDefinition,
} from "../../subagents/definitions";
import { loadSubagentDefinitions } from "../../subagents/loadSubagents";
import { MAX_CONCURRENT_SUBAGENTS } from "../../subagents/scheduling";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export function buildSubagentTool(agents: SubagentDefinition[]): Tool {
  const list = agents
    .map((a) => `- ${a.name}: ${a.description.replace(/\s+/g, " ")}`)
    .join("\n");
  return {
    type: "function",
    displayTitle: "Subagent",
    wouldLikeTo: "start the {{{ agent }}} subagent",
    isCurrently: "running the {{{ agent }}} subagent",
    hasAlready: "ran the {{{ agent }}} subagent",
    // Starting a subagent changes nothing by itself: each of its tool calls
    // is checked against the same policies as the parent's and asks the
    // person when the parent's would.
    readonly: true,
    isInstant: false,
    group: BUILT_IN_GROUP_NAME,
    defaultToolPolicy: "allowedWithoutPermission",
    function: {
      name: BuiltInToolNames.Subagent,
      description: `Start a subagent: a fresh conversation with its own instructions and a subset of your tools, which works on one task and returns a single report. It does not see this conversation, so put everything it needs in the prompt. Only its final report comes back; its tool output does not.

Use one for broad searches or questions that need many files read when only the conclusion matters, or for independent pieces of read-only work. Do not use one for a single known file or a quick search you can do yourself, or for edits. Several subagent calls in one message run in parallel (at most ${MAX_CONCURRENT_SUBAGENTS} at a time). Subagents cannot start subagents.

Available agents:
${list}`,
      parameters: {
        type: "object",
        required: ["agent", "description", "prompt"],
        properties: {
          agent: {
            type: "string",
            description: "Name of the agent to start, from the list above.",
          },
          description: {
            type: "string",
            description: "A short (3-5 word) label for the task.",
          },
          prompt: {
            type: "string",
            description:
              "The task, with all the context the agent needs and what its report should contain.",
          },
        },
      },
    },
  };
}

export const subagentTool: GetTool = async (params) => {
  // Agent files must not be able to break config loading: if they cannot be
  // read at all, the built-in agents are still offered.
  try {
    const { agents } = await loadSubagentDefinitions(params.ide);
    return buildSubagentTool(agents);
  } catch {
    return buildSubagentTool(BUILT_IN_SUBAGENTS);
  }
};
