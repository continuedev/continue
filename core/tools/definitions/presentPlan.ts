import { Tool } from "../..";
import {
  PLAN_LIMITS,
  PLANS_DIR,
  PRESENT_PLAN_TODO_DETAILS_PARAMETER,
  PRESENT_PLAN_TOOL_DESCRIPTION,
} from "../../util/planFile";
import { TASK_PLAN_LIMITS } from "../../util/taskPlan";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

/**
 * Ends Plan mode's work: the gui writes the plan to `.continuous/plans/<slug>.md`,
 * makes its to-dos the task list, ends the turn and shows the plan with Build
 * and Keep planning. Offered in Plan mode only (selectActiveTools).
 */
export const presentPlanTool: Tool = {
  type: "function",
  displayTitle: "Present Plan",
  wouldLikeTo: "present the plan",
  isCurrently: "presenting the plan",
  hasAlready: "presented the plan",
  // It writes only its own plan file under .continuous/plans, never the
  // person's code, so Plan mode (which keeps read-only built-ins) keeps it.
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.PresentPlan,
    description: PRESENT_PLAN_TOOL_DESCRIPTION,
    parameters: {
      type: "object",
      required: ["title", "plan", "todos"],
      properties: {
        title: {
          type: "string",
          description: `A short name for the work, at most ${PLAN_LIMITS.maxTitleLength} characters. It names the file in ${PLANS_DIR}.`,
        },
        plan: {
          type: "string",
          description:
            "The plan in markdown for a person to read: goal, approach, files involved, risks. Not the to-dos.",
        },
        todos: {
          type: "array",
          description: `The implementation steps in order, at most ${TASK_PLAN_LIMITS.maxItems}, each at most ${TASK_PLAN_LIMITS.maxTextLength} characters.`,
          items: { type: "string" },
        },
        todo_details: PRESENT_PLAN_TODO_DETAILS_PARAMETER,
      },
    },
  },
  systemMessageDescription: {
    prefix: `When your plan is ready in Plan mode, present it for approval with the ${BuiltInToolNames.PresentPlan} tool instead of asking the user to switch modes, then stop. For example:`,
    exampleArgs: [
      ["title", "Add retry to the uploader"],
      ["plan", "Uploads fail on flaky networks. Wrap upload() in a retry."],
      ["todos", `["Add a retry helper","Use it in upload()","Add tests"]`],
    ],
  },
  defaultToolPolicy: "allowedWithoutPermission",
  toolCallIcon: "ClipboardDocumentListIcon",
};
