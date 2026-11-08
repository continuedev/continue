import {
  FINISH_ITEM_PARAMETERS,
  FINISH_ITEM_TOOL_DESCRIPTION,
  HOLD_QUESTION_PARAMETERS,
  holdQuestionToolDescription,
  REMIND_ME_PARAMETERS,
  REMIND_ME_TOOL_DESCRIPTION,
} from "core/tools/definitions/loopTools.js";
import {
  finishItemReport,
  finishItemResultFor,
  holdQuestion,
  holdQuestionResult,
} from "core/util/loopMode.js";
import {
  reminderFilePaths,
  reminderSavedResult,
  saveLaterReminder,
  saveReminder,
} from "core/util/loopReminders.js";

import { stampFile } from "../loop/loopReminderFiles.js";
import {
  CLI_LOOP_TOOL_NAMES,
  commitLoop,
  getSessionLoop,
  requestLoopTurnEnd,
} from "../loop/loopSession.js";
import { getSessionTaskPlan } from "../session.js";

import type { Tool, ToolParametersSchema } from "./types.js";

/**
 * Loop mode's tools in the CLI, offered only while the loop runs an
 * item (getAllAvailableTools), with the IDE's descriptions and parameters
 * (core/tools/definitions/loopTools.ts). Design: plans/loop-mode.md.
 */

export const HOLD_QUESTION_TOOL_NAME = CLI_LOOP_TOOL_NAMES.holdQuestion;
export const FINISH_ITEM_TOOL_NAME = CLI_LOOP_TOOL_NAMES.finishItem;
export const REMIND_ME_TOOL_NAME = CLI_LOOP_TOOL_NAMES.remindMe;

/** Core's schema with a description on every property, as the CLI's type wants. */
function withDescriptions(
  schema: {
    required: string[];
    properties: Record<string, { type: string; description?: string }>;
  },
  descriptions: Record<string, string>,
): ToolParametersSchema {
  return {
    type: "object",
    required: schema.required,
    properties: Object.fromEntries(
      Object.entries(schema.properties).map(([key, value]) => [
        key,
        { ...value, description: value.description ?? descriptions[key] },
      ]),
    ) as ToolParametersSchema["properties"],
  };
}

function runningItem() {
  const loop = getSessionLoop();
  if (!loop || loop.current?.kind !== "item" || !loop.current.itemId) {
    throw new Error("This tool is only for an item that Loop mode is running.");
  }
  return { loop, itemId: loop.current.itemId };
}

export const holdQuestionTool: Tool = {
  name: HOLD_QUESTION_TOOL_NAME,
  displayName: "Hold Question",
  description: holdQuestionToolDescription(FINISH_ITEM_TOOL_NAME),
  readonly: true,
  isBuiltIn: true,
  parameters: withDescriptions(HOLD_QUESTION_PARAMETERS, {
    kind: '"assumption" (go on with your default) or "blocking"',
  }),
  run: async (args: Record<string, unknown>) => {
    const { loop, itemId } = runningItem();
    const result = holdQuestion(
      loop,
      {
        itemId,
        question: args?.question,
        kind: args?.kind,
        assumption: args?.assumption,
        type: args?.type,
        toolNames: CLI_LOOP_TOOL_NAMES,
      },
      new Date(),
    );
    if (!result.ok) {
      throw new Error(result.error);
    }
    commitLoop(result.loop);
    return holdQuestionResult(
      result.question,
      result.duplicate,
      CLI_LOOP_TOOL_NAMES,
    );
  },
};

export const remindMeTool: Tool = {
  name: REMIND_ME_TOOL_NAME,
  displayName: "Remind Me",
  description: REMIND_ME_TOOL_DESCRIPTION,
  readonly: true,
  isBuiltIn: true,
  parameters: REMIND_ME_PARAMETERS as ToolParametersSchema,
  run: async (args: Record<string, unknown>) => {
    const { loop, itemId } = runningItem();
    const result = saveReminder(
      loop,
      getSessionTaskPlan(),
      {
        fromItemId: itemId,
        note: args?.note,
        when: args?.when,
        item: args?.item,
        files: reminderFilePaths(args?.files).map((path) => ({
          path,
          stamp: stampFile(path),
        })),
      },
      new Date(),
    );
    if (!result.ok) {
      throw new Error(result.error);
    }
    commitLoop(result.loop);
    return reminderSavedResult(result.reminder, result.duplicate);
  },
};

export const finishItemTool: Tool = {
  name: FINISH_ITEM_TOOL_NAME,
  displayName: "Finish Item",
  description: FINISH_ITEM_TOOL_DESCRIPTION,
  readonly: true,
  isBuiltIn: true,
  parameters: withDescriptions(FINISH_ITEM_PARAMETERS, {
    outcome: "done, waiting, stuck or later",
  }),
  run: async (args: Record<string, unknown>) => {
    const { loop, itemId } = runningItem();
    const parsed = finishItemReport(args);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }
    const { report, later } = parsed;
    const result = finishItemResultFor(loop, itemId, report.outcome);
    const saved = later
      ? saveLaterReminder(
          loop,
          itemId,
          later.note,
          later.files.map((path) => ({ path, stamp: stampFile(path) })),
          new Date(),
        )
      : loop;
    commitLoop({
      ...saved,
      current: saved.current && { ...saved.current, report },
    });
    // The loop picks what comes next; no need to ask the model again
    requestLoopTurnEnd();
    return result;
  },
};
