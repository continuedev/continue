import { ContinueError, ContinueErrorReason } from "core/util/errors";
import {
  finishItemReport,
  finishItemResultFor,
  holdQuestion,
  holdQuestionResult,
} from "core/util/loopMode";
import {
  reminderFilePaths,
  reminderSavedResult,
  saveLaterReminder,
  saveReminder,
} from "core/util/loopReminders";
import { stampLoopFiles } from "../../redux/util/loopReminderFiles";
import { commitLoop } from "../../redux/util/loopCommit";
import { ClientToolImpl } from "./callClientTool";

function runningItem(extras: Parameters<ClientToolImpl>[2]) {
  const loop = extras.getState().session.loop;
  if (!loop || loop.current?.kind !== "item" || !loop.current.itemId) {
    throw new ContinueError(
      ContinueErrorReason.Unspecified,
      "This tool is only for an item that Loop mode is running.",
    );
  }
  return { loop, itemId: loop.current.itemId };
}

/** hold_question: puts a question in the loop's inbox; the turn goes on. */
export const holdQuestionImpl: ClientToolImpl = async (
  args,
  _toolCallId,
  extras,
) => {
  const { loop, itemId } = runningItem(extras);
  const result = holdQuestion(
    loop,
    {
      itemId,
      question: args?.question,
      kind: args?.kind,
      assumption: args?.assumption,
      type: args?.type,
    },
    new Date(),
  );
  if (!result.ok) {
    throw new ContinueError(ContinueErrorReason.Unspecified, result.error);
  }
  commitLoop(extras.dispatch, extras.getState, result.loop);
  return {
    respondImmediately: true,
    output: [
      {
        name: "Question held",
        description: `${result.question.id} (${result.question.kind})`,
        content: holdQuestionResult(result.question, result.duplicate),
        hidden: false,
      },
    ],
  };
};

/** remind_me: saves a note for a later run; the turn goes on. */
export const remindMeImpl: ClientToolImpl = async (
  args,
  _toolCallId,
  extras,
) => {
  const { itemId } = runningItem(extras);
  const paths = reminderFilePaths(args?.files);
  const stamps = await stampLoopFiles(extras.ideMessenger.ide, paths);
  // The read above took time: save on the loop as it is now
  const { loop } = runningItem(extras);
  const result = saveReminder(
    loop,
    extras.getState().session.taskPlan,
    {
      fromItemId: itemId,
      note: args?.note,
      when: args?.when,
      item: args?.item,
      files: paths.map((path) => ({ path, stamp: stamps[path] })),
    },
    new Date(),
  );
  if (!result.ok) {
    throw new ContinueError(ContinueErrorReason.Unspecified, result.error);
  }
  commitLoop(extras.dispatch, extras.getState, result.loop);
  return {
    respondImmediately: true,
    output: [
      {
        name: "Reminder saved",
        description: result.reminder.id,
        content: reminderSavedResult(result.reminder, result.duplicate),
        hidden: false,
      },
    ],
  };
};

/** finish_item: records the run's report and ends the turn. */
export const finishItemImpl: ClientToolImpl = async (
  args,
  _toolCallId,
  extras,
) => {
  const { itemId } = runningItem(extras);
  const parsed = finishItemReport(args);
  if (!parsed.ok) {
    throw new ContinueError(ContinueErrorReason.Unspecified, parsed.error);
  }
  const { report, later } = parsed;
  const stamps = await stampLoopFiles(
    extras.ideMessenger.ide,
    later?.files ?? [],
  );
  // The read above took time: report on the loop as it is now
  const { loop } = runningItem(extras);
  const result = finishItemResultFor(loop, itemId, report.outcome);
  const saved = later
    ? saveLaterReminder(
        loop,
        itemId,
        later.note,
        later.files.map((path) => ({ path, stamp: stamps[path] })),
        new Date(),
      )
    : loop;
  commitLoop(extras.dispatch, extras.getState, {
    ...saved,
    current: saved.current && { ...saved.current, report },
  });
  return {
    respondImmediately: true,
    // The loop picks what comes next; no need to ask the model again
    endTurn: true,
    output: [
      {
        name: "Item reported",
        description: report.outcome,
        content: result,
        hidden: false,
      },
    ],
  };
};
