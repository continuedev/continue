import { ContinueError, ContinueErrorReason } from "core/util/errors";
import {
  FinishOutcome,
  finishItemResult,
  holdQuestion,
  holdQuestionResult,
  LOOP_LIMITS,
} from "core/util/loopMode";
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

const OUTCOMES: FinishOutcome[] = ["done", "waiting", "stuck"];

/** finish_item: records the run's report and ends the turn. */
export const finishItemImpl: ClientToolImpl = async (
  args,
  _toolCallId,
  extras,
) => {
  const { loop } = runningItem(extras);
  const outcome = args?.outcome as FinishOutcome;
  if (!OUTCOMES.includes(outcome)) {
    throw new ContinueError(
      ContinueErrorReason.Unspecified,
      `outcome must be one of ${OUTCOMES.join(", ")}`,
    );
  }
  const summary =
    typeof args?.summary === "string"
      ? args.summary.trim().slice(0, LOOP_LIMITS.maxSummaryLength)
      : undefined;
  const notes =
    typeof args?.notes === "string"
      ? args.notes.trim().slice(0, LOOP_LIMITS.maxNoteLength)
      : undefined;
  commitLoop(extras.dispatch, extras.getState, {
    ...loop,
    current: loop.current && {
      ...loop.current,
      report: {
        outcome,
        ...(summary ? { summary } : {}),
        ...(notes ? { notes } : {}),
      },
    },
  });
  return {
    respondImmediately: true,
    // The loop picks what comes next; no need to ask the model again
    endTurn: true,
    output: [
      {
        name: "Item reported",
        description: outcome,
        content: finishItemResult(outcome),
        hidden: false,
      },
    ],
  };
};
