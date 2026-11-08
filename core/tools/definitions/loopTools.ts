import { Tool } from "../..";
import { LOOP_LIMITS, QUESTION_TYPES } from "../../util/loopMode";
import {
  LOOP_REMINDER_LIMITS,
  LOOP_REMINDER_WHEN,
} from "../../util/loopReminders";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

/**
 * Loop mode's tools, offered only while the loop runs an item
 * (selectActiveTools). They run in the gui, which holds the loop's state.
 * Design: plans/loop-mode.md; the question types and the wording:
 * plans/policy-areas.md and policy-areas-prompts.md in the session notes.
 */

/** hold_question's description; `finishItem` is the name the reader knows finish_item by. */
export function holdQuestionToolDescription(finishItem: string): string {
  return `Put a question in the person's inbox and keep working. They answer while work goes on; the answer reaches you now or a later run of this item.

- type: what a wrong answer would cost. access: something only the person can supply (a credential, a login, the output of something you cannot run). irreversible: deleting, publishing, migrating, anything hard to undo. security: credentials, permissions, exposure. cost: money or a large share of a budget. scope: what to build, add or drop. design: approach, library, architecture, interfaces, data flow. detail: naming, formatting, small defaults. A question on two of these takes the costlier one. Who answers depends on the type and the person's settings.
- kind "assumption" (the usual choice): you go on with the default you state in \`assumption\`. If the person overrules it, the item is redone.
- kind "blocking": only when there is no reasonable default. Do what you can without the answer, then call ${finishItem} with outcome "waiting".
- options: two to four short choices when they exist, your default first.

Make the question answerable on its own, without this conversation: say what it is about, the options, and your default.`;
}

// `type` is asked for in the description but not required by the schema: the
// CLI rejects a call missing a required parameter, and a model that omits
// the type must still be able to ask. A missing type is routed to the person.
export const HOLD_QUESTION_PARAMETERS = {
  type: "object" as const,
  required: ["question", "kind"],
  properties: {
    question: {
      type: "string",
      description: `The question, self-contained, at most ${LOOP_LIMITS.maxQuestionLength} characters`,
    },
    type: {
      type: "string",
      enum: [...QUESTION_TYPES],
      description: "What a wrong answer would cost",
    },
    kind: {
      type: "string",
      enum: ["assumption", "blocking"],
    },
    assumption: {
      type: "string",
      description:
        'The default you are continuing with. Required for kind "assumption".',
    },
    options: {
      type: "array",
      items: { type: "string" },
      description: "Two to four short choices, your default first",
    },
  },
};

export const FINISH_ITEM_TOOL_DESCRIPTION =
  'Report the item you were given and end your turn. This is the only way to end a turn: a turn that ends without it is not counted. outcome "done" when it is finished; "waiting" when it needs an answer to a blocking question; "stuck" when you cannot finish it (say why in summary); "later" when another item may settle it: the item comes back after the others, once, and needs `reminder`. A second "later" counts as stuck.';

export const FINISH_ITEM_PARAMETERS = {
  type: "object" as const,
  required: ["outcome", "summary"],
  properties: {
    outcome: {
      type: "string",
      enum: ["done", "waiting", "stuck", "later"],
    },
    summary: {
      type: "string",
      description: `One line: what you did, or why it is not done. At most ${LOOP_LIMITS.maxSummaryLength} characters.`,
    },
    notes: {
      type: "string",
      description: `Optional. What a later item should know: a command that works, a trap you hit. One or two lines, at most ${LOOP_LIMITS.maxNoteLength} characters; not progress.`,
    },
    reminder: {
      type: "string",
      description: `Required for outcome "later": what you tried, what you learned, and why it may go better later. At most ${LOOP_REMINDER_LIMITS.maxLength} characters.`,
    },
    files: {
      type: "array",
      items: { type: "string" },
      description:
        'With outcome "later": paths of the files the reminder depends on',
    },
  },
};

export const REMIND_ME_TOOL_DESCRIPTION = `Save a note for a later run. Each item starts without this conversation, so what you do not save is gone. It is saved at once, so it survives a stopped run. Use it for what a later run would otherwise have to find again: a cause you tracked down, a command that works, a trap.

- when "item": for the run of the item numbered in \`item\`
- when "next_items": for the next item that runs
- when "retry": for a later run of this item
- when "replan": for the next re-plan

Each reminder is delivered once. List in \`files\` the files it depends on: if they change before it is delivered, it arrives marked to check first.`;

export const REMIND_ME_PARAMETERS = {
  type: "object" as const,
  required: ["note", "when"],
  properties: {
    note: {
      type: "string",
      description: `What the later run needs, self-contained, at most ${LOOP_REMINDER_LIMITS.maxLength} characters`,
    },
    when: {
      type: "string",
      enum: [...LOOP_REMINDER_WHEN],
      description: "Which run it is for",
    },
    item: {
      type: "string",
      description:
        'The number of the item in the plan. Required for when "item".',
    },
    files: {
      type: "array",
      items: { type: "string" },
      description: `Paths of the files the note depends on, at most ${LOOP_REMINDER_LIMITS.maxFiles}`,
    },
  },
};

export const holdQuestionTool: Tool = {
  type: "function",
  displayTitle: "Hold Question",
  wouldLikeTo: "ask the person a question",
  isCurrently: "asking the person a question",
  hasAlready: "asked the person a question",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.HoldQuestion,
    description: holdQuestionToolDescription(BuiltInToolNames.FinishItem),
    parameters: HOLD_QUESTION_PARAMETERS,
  },
  defaultToolPolicy: "allowedWithoutPermission",
  toolCallIcon: "QuestionMarkCircleIcon",
};

export const remindMeTool: Tool = {
  type: "function",
  displayTitle: "Remind Me",
  wouldLikeTo: "save a reminder",
  isCurrently: "saving a reminder",
  hasAlready: "saved a reminder",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.RemindMe,
    description: REMIND_ME_TOOL_DESCRIPTION,
    parameters: REMIND_ME_PARAMETERS,
  },
  defaultToolPolicy: "allowedWithoutPermission",
  toolCallIcon: "BookmarkIcon",
};

export const finishItemTool: Tool = {
  type: "function",
  displayTitle: "Finish Item",
  wouldLikeTo: "report the item",
  isCurrently: "reporting the item",
  hasAlready: "reported the item",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.FinishItem,
    description: FINISH_ITEM_TOOL_DESCRIPTION,
    parameters: FINISH_ITEM_PARAMETERS,
  },
  defaultToolPolicy: "allowedWithoutPermission",
  toolCallIcon: "CheckCircleIcon",
};
