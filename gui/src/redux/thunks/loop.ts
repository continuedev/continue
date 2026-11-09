import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  LoopAutonomy,
  LoopBudget,
  LoopState,
  LoopStrategy,
  MessageModes,
  ModelUse,
} from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { finishItemNudge, presentPlanNudge } from "core/util/turnEnd";
import { applyModeModel } from "./applyModeModel";
import {
  acceptReplan,
  answerLoop,
  answersToDeliver,
  createLoop,
  decideNext,
  endReplan,
  finishItemRun,
  holdCheck,
  loopItemPrompt,
  loopReplanTurnPrompt,
  markDelivered,
  enterWait,
  loopAutonomyFor,
  loopTokensFromUsage,
  proceedUnanswered,
  reconcileLoop,
  releaseEmptyWait,
  replanDecision,
  setLoopAutonomy,
  setLoopStrategy,
  requestStop,
  resumeLoop,
  runItemAgain,
  setLoopBudget,
  settleSteeredAnswers,
  skipItem,
  type LoopControlResult,
  startItemRun,
  standingInstructions,
  startReplan,
  stopLoop,
} from "core/util/loopMode";
import {
  reminderPathsDue,
  replanReminderTarget,
  takeReminders,
} from "core/util/loopReminders";
import { modelForLoopItem } from "core/util/modelUse";
import { parsePlanFile, taskPlanFromPlanFile } from "core/util/planFile";
import { findUriInDirs } from "core/util/uri";
import { selectEffectiveApprovalMode } from "../selectors/selectAutoApproval";
import {
  enqueueMessage,
  removeQueuedMessage,
  setLoop,
  setLoopRequested,
  setMode,
  setModeAfterLoop,
  setTaskPlan,
} from "../slices/sessionSlice";
import { AppThunkDispatch, RootState, ThunkApiType } from "../store";
import { getModeModelTitle } from "../../util/modeModels";
import { commitLoop } from "../util/loopCommit";
import { stampLoopFiles } from "../util/loopReminderFiles";

import { runLoopCheck } from "./loopChecks";
import { streamResponseThunk } from "./streamResponse";

/**
 * Loop mode in the gui: the thunks that start, advance, answer and stop the
 * loop. The decisions are core's (core/util/loopMode.ts); these apply them to
 * the session and send the turns. useLoopDriver calls advanceLoop whenever
 * nothing is running. Design: plans/loop-mode.md.
 */

function doc(text: string) {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

function sessionTokens(state: RootState): number {
  const usage = state.session.usage;
  return usage ? loopTokensFromUsage(usage) : 0;
}

async function displayPath(
  fileUri: string | undefined,
  getWorkspaceDirs: () => Promise<string[]>,
): Promise<string | undefined> {
  if (!fileUri) return undefined;
  try {
    const { relativePathOrBasename, foundInDir } = findUriInDirs(
      fileUri,
      await getWorkspaceDirs(),
    );
    return foundInDir ? relativePathOrBasename : fileUri;
  } catch {
    return fileUri;
  }
}

/**
 * Sends a Loop turn. The model is switched first to the one `modeModels` gives
 * this kind of turn (`loop` for an item, `replan` otherwise, with the agent and
 * plan entries as fallbacks), or to `title`, an item's own model: the mode's
 * own effect runs after a render, which may be later than the request.
 */
async function sendLoopTurn(
  dispatch: AppThunkDispatch,
  text: string,
  use?: ModelUse,
  title?: string,
) {
  if (use) await dispatch(applyModeModel({ mode: use, title }));
  await dispatch(
    streamResponseThunk({
      editorState: doc(text),
      modifiers: { noContext: true, useCodebase: false },
    }),
  );
}

/** Reads the plan file back (the person may have edited it) into the task list. */
async function readPlanIntoTaskList(
  planFile: string,
  dispatch: AppThunkDispatch,
  getState: () => RootState,
  readFile: (uri: string) => Promise<string>,
): Promise<{ title?: string }> {
  try {
    const markdown = await readFile(planFile);
    const result = taskPlanFromPlanFile(markdown, getState().session.taskPlan);
    if (result.ok) {
      dispatch(setTaskPlan(result.plan));
      return { title: result.title };
    }
    console.warn(`Plan file to-dos not used: ${result.error}`);
  } catch (e) {
    console.warn("Could not read the plan file", e);
  }
  return {};
}

/** "Build in a loop" on a plan card: seed the loop from the plan's to-dos. */
export const startLoopFromPlan = createAsyncThunk<
  void,
  { planFile: string },
  ThunkApiType
>("loop/start", async ({ planFile }, { dispatch, getState, extra }) => {
  await readPlanIntoTaskList(planFile, dispatch, getState, (uri) =>
    extra.ideMessenger.ide.readFile(uri),
  );
  const plan = getState().session.taskPlan;
  if (!plan) return;
  const loop = createLoop(plan, {
    now: new Date(),
    sessionTokens: sessionTokens(getState()),
    // How much it does alone follows the approval mode in force
    autonomy: loopAutonomyFor(selectEffectiveApprovalMode(getState())),
  });
  dispatch(setMode("agent"));
  commitLoop(dispatch, getState, loop);
});

/** The loop's re-plan card: accept it and start the next round. */
export const acceptLoopPlan = createAsyncThunk<void, undefined, ThunkApiType>(
  "loop/acceptPlan",
  async (_, { dispatch, getState, extra }) => {
    const { loop, planFile } = getState().session;
    if (!loop || loop.status !== "awaiting_plan") return;
    if (planFile) {
      await readPlanIntoTaskList(planFile, dispatch, getState, (uri) =>
        extra.ideMessenger.ide.readFile(uri),
      );
    }
    const plan = getState().session.taskPlan;
    if (!plan) return;
    dispatch(setMode("agent"));
    commitLoop(
      dispatch,
      getState,
      acceptReplan(loop, plan, {
        now: new Date(),
        sessionTokens: sessionTokens(getState()),
      }),
    );
  },
);

/** Whether the session's loop is going (any status but stopped). */
function loopActive(state: RootState): boolean {
  const { loop } = state.session;
  return !!loop && loop.status !== "stopped";
}

/**
 * Loop in the mode picker. It is not a mode: the first message is a Plan
 * turn, and the plan it presents starts the loop (presentPlanImpl). A loop
 * already going keeps the mode it runs in.
 */
export const chooseLoopMode = createAsyncThunk<void, undefined, ThunkApiType>(
  "loop/chooseMode",
  async (_, { dispatch, getState }) => {
    dispatch(setModeAfterLoop(undefined));
    dispatch(setLoopRequested(true));
    if (!loopActive(getState())) dispatch(setMode("plan"));
  },
);

/**
 * Chat, Plan or Agent picked while in Loop: a running loop stops after the
 * running item, and the mode is taken when it stops (setLoop), so the item
 * finishes in its own mode. Otherwise the mode is taken at once.
 */
export const leaveLoopMode = createAsyncThunk<void, MessageModes, ThunkApiType>(
  "loop/leaveMode",
  async (mode, { dispatch, getState }) => {
    dispatch(setLoopRequested(false));
    if (loopActive(getState())) {
      dispatch(setModeAfterLoop(mode));
      await dispatch(stopLoopThunk());
      return;
    }
    dispatch(setModeAfterLoop(undefined));
    dispatch(setMode(mode));
  },
);

/**
 * A plan presented while the person is in Loop starts the loop by itself,
 * unless a loop is already going (its own re-plan is accepted as before).
 */
export const startLoopIfRequested = createAsyncThunk<
  boolean,
  { planFile: string },
  ThunkApiType
>("loop/startIfRequested", async ({ planFile }, { dispatch, getState }) => {
  const state = getState();
  if (!state.session.loopRequested || loopActive(state)) return false;
  await dispatch(startLoopFromPlan({ planFile }));
  return loopActive(getState());
});

export const stopLoopThunk = createAsyncThunk<void, undefined, ThunkApiType>(
  "loop/stop",
  async (_, { dispatch, getState }) => {
    const { loop } = getState().session;
    if (!loop || loop.status === "stopped") return;
    commitLoop(dispatch, getState, requestStop(loop));
  },
);

export const resumeLoopThunk = createAsyncThunk<void, undefined, ThunkApiType>(
  "loop/resume",
  async (_, { dispatch, getState }) => {
    const { loop } = getState().session;
    if (!loop || loop.status !== "stopped") return;
    commitLoop(
      dispatch,
      getState,
      resumeLoop(loop, {
        now: new Date(),
        sessionTokens: sessionTokens(getState()),
      }),
    );
  },
);

/** Ends the loop and forgets it (the task list stays). */
/** The inbox's level picker: change how much the running loop does alone. */
export const setLoopAutonomyThunk = createAsyncThunk<
  void,
  LoopAutonomy,
  ThunkApiType
>("loop/setAutonomy", async (autonomy, { dispatch, getState }) => {
  const { loop } = getState().session;
  if (!loop) return;
  commitLoop(dispatch, getState, setLoopAutonomy(loop, autonomy));
});

type LoopControlOutcome = { ok: boolean; error?: string };

/** Applies one of core's controls to the session's loop. */
function control(
  dispatch: AppThunkDispatch,
  getState: () => RootState,
  apply: (loop: LoopState) => LoopControlResult,
): LoopControlOutcome {
  const { loop } = getState().session;
  if (!loop) return { ok: false, error: "No loop is running" };
  const result = apply(loop);
  if (!result.ok) return result;
  commitLoop(dispatch, getState, result.loop);
  return { ok: true };
}

/** Skip an item that is not running: it counts as finished, shown cancelled. */
export const skipLoopItemThunk = createAsyncThunk<
  LoopControlOutcome,
  string,
  ThunkApiType
>("loop/skipItem", async (itemId, { dispatch, getState }) =>
  control(dispatch, getState, (loop) => skipItem(loop, itemId)),
);

/** Run a done, failed or skipped item again. */
export const runLoopItemAgainThunk = createAsyncThunk<
  LoopControlOutcome,
  string,
  ThunkApiType
>("loop/runItemAgain", async (itemId, { dispatch, getState }) =>
  control(dispatch, getState, (loop) => runItemAgain(loop, itemId)),
);

/** The inbox's limits editor and re-plan picker: core checks the bounds. */
export const setLoopBudgetThunk = createAsyncThunk<
  LoopControlOutcome,
  Partial<LoopBudget>,
  ThunkApiType
>("loop/setBudget", async (budget, { dispatch, getState }) =>
  control(dispatch, getState, (loop) => setLoopBudget(loop, budget)),
);

/** The inbox's strategy picker: how the running loop moves through the plan. */
export const setLoopStrategyThunk = createAsyncThunk<
  void,
  LoopStrategy,
  ThunkApiType
>("loop/setStrategy", async (strategy, { dispatch, getState }) => {
  const { loop } = getState().session;
  if (!loop) return;
  commitLoop(dispatch, getState, setLoopStrategy(loop, strategy));
});

export const endLoopThunk = createAsyncThunk<void, undefined, ThunkApiType>(
  "loop/end",
  async (_, { dispatch }) => {
    dispatch(setLoop(undefined));
  },
);

export interface LoopAnswerInput {
  questionId?: string;
  itemId?: string;
  text: string;
  confirm?: boolean;
  approve?: boolean;
  replanNow?: boolean;
  standing?: boolean;
}

/**
 * The person answered from the inbox. Core routes it by the item's state; an
 * answer for the running item is queued as a steered message, so it reaches
 * the model at its next tool boundary without stopping the turn.
 */
export const answerLoopQuestion = createAsyncThunk<
  { ok: boolean; error?: string },
  LoopAnswerInput,
  ThunkApiType
>("loop/answer", async (input, { dispatch, getState }) => {
  const { loop } = getState().session;
  if (!loop) return { ok: false, error: "No loop is running" };
  const result = answerLoop(loop, input, new Date());
  if (!result.ok) return result;
  const { answer } = result;
  commitLoop(dispatch, getState, result.loop);
  if (answer.route === "steer") {
    const question = result.loop.questions.find(
      (q) => q.id === answer.questionId,
    );
    const text = question
      ? `The person answered your question ${question.id} ("${question.question}"): ${answer.text}`
      : `A note from the person about this item: ${answer.text}`;
    dispatch(
      enqueueMessage({
        editorState: doc(text),
        modifiers: { noContext: true, useCodebase: false },
        steer: true,
        loopAnswerId: answer.id,
      }),
    );
  }
  return { ok: true };
});

/** The finish_item and present_plan calls made since a run started. */
function callsSince(state: RootState, historyIndex: number, name: string) {
  return state.session.history
    .slice(historyIndex)
    .flatMap((item) => item.toolCallStates ?? [])
    .filter((tc) => tc.toolCall.function.name === name);
}

/**
 * One step of the loop, run when nothing is streaming: finish what ran, then
 * decide what is next and start it. Resolves when the turn it started ends.
 */
export const advanceLoop = createAsyncThunk<void, undefined, ThunkApiType>(
  "loop/advance",
  async (_, { dispatch, getState, extra }) => {
    const ide = extra.ideMessenger.ide;
    let state = getState();
    let loop = state.session.loop;
    if (!loop || loop.status === "stopped" || loop.status === "awaiting_plan") {
      return;
    }
    const now = new Date();

    // 1. Finish what ran.
    if (loop.current?.kind === "item") {
      // A run that ended without its report is told once to call finish_item,
      // in the same run; only a second such end counts as an attempt
      // (core/util/turnEnd.ts)
      if (!loop.current.report && !loop.current.nudged) {
        commitLoop(dispatch, getState, {
          ...loop,
          current: { ...loop.current, nudged: true },
        });
        await sendLoopTurn(
          dispatch,
          finishItemNudge(BuiltInToolNames.FinishItem),
        );
        return;
      }
      const queuedIds = new Set(
        state.session.queuedMessages
          .map((m) => m.loopAnswerId)
          .filter((id): id is string => !!id),
      );
      // Steered answers still queued did not reach the run
      for (const m of state.session.queuedMessages) {
        if (m.loopAnswerId) dispatch(removeQueuedMessage(m.id));
      }
      const delivered = loop.answers
        .filter((a) => a.route === "steer" && !queuedIds.has(a.id))
        .map((a) => a.id);
      // An item with a check is not done until its check passes
      const itemId = loop.current.itemId;
      const check = state.session.taskPlan?.items.find(
        (t) => t.id === itemId,
      )?.check;
      loop = finishItemRun(loop, loop.current.report, { check });
      loop = settleSteeredAnswers(loop, delivered);
      if (itemId) loop = releaseEmptyWait(loop, itemId);
    } else if (loop.current?.kind === "check") {
      // A check that did not finish (the gui reloaded while it ran): the
      // item stays checking, and its check runs again
      loop = holdCheck(loop);
    } else if (loop.current?.kind === "replan") {
      const presented = callsSince(
        state,
        loop.current.historyIndex,
        BuiltInToolNames.PresentPlan,
      ).some((tc) => tc.status === "done");
      if (!presented) {
        // One nudge first, in the same run: a small model wrote the
        // present_plan call as text once in six runs, and one text reply
        // must not end the whole loop (core/util/turnEnd.ts)
        if (!loop.current.nudged) {
          commitLoop(dispatch, getState, {
            ...loop,
            current: { ...loop.current, nudged: true },
          });
          await sendLoopTurn(
            dispatch,
            presentPlanNudge(BuiltInToolNames.PresentPlan),
          );
          return;
        }
        commitLoop(
          dispatch,
          getState,
          stopLoop(
            loop,
            "replan_failed",
            "The re-plan ended without presenting a plan.",
          ),
        );
        return;
      }
      // The loop's autonomy level (and, for a repair, its scope) says which
      // re-plans start by themselves; anything else waits on the plan card.
      const ended = endReplan(loop, getState().session.taskPlan);
      commitLoop(dispatch, getState, ended.loop);
      if (ended.accept) {
        await dispatch(acceptLoopPlan());
      }
      return;
    }

    // 2. Decide what is next.
    state = getState();
    const plan = state.session.taskPlan;
    if (!plan) {
      commitLoop(
        dispatch,
        getState,
        stopLoop(loop, "done", "The task list is empty."),
      );
      return;
    }
    loop = reconcileLoop(loop, plan);
    const action = decideNext(loop, plan, {
      now,
      sessionTokens: sessionTokens(state),
    });
    const planFile = await displayPath(state.session.planFile, () =>
      ide.getWorkspaceDirs(),
    );

    switch (action.kind) {
      case "none":
        commitLoop(dispatch, getState, loop);
        return;
      case "wait":
        // useLoopDriver wakes the loop at action.until (unattended)
        commitLoop(dispatch, getState, enterWait(loop, now));
        return;
      case "proceed":
        // Unattended and nobody answered in time: the items go on
        commitLoop(dispatch, getState, proceedUnanswered(loop));
        return;
      case "stop":
        commitLoop(
          dispatch,
          getState,
          stopLoop(loop, action.reason, action.detail),
        );
        return;
      case "run": {
        const item = plan.items.find((i) => i.id === action.itemId)!;
        const reminderTarget = { kind: "item", itemId: action.itemId } as const;
        const taken = takeReminders(
          loop,
          reminderTarget,
          await stampLoopFiles(ide, reminderPathsDue(loop, reminderTarget)),
          now,
        );
        loop = taken.loop;
        const itemState = loop.items.find((i) => i.id === action.itemId);
        const answers = answersToDeliver(loop, action.itemId);
        const prompt = loopItemPrompt({
          item,
          planFile,
          answers,
          questions: loop.questions,
          redo: itemState?.status === "redo",
          again: itemState?.again,
          attempt: (itemState?.attempts ?? 0) + 1,
          notes: loop.notes,
          standing: standingInstructions(loop),
          freshContext: loop.freshContext !== false,
          // A failed check's output, for the item to fix
          lastCheck: itemState?.check,
          // The request carries the plan block (loopPlanBlock)
          planBlock: true,
          reminders: taken.reminders,
          returning: itemState?.setAside,
          decideAlone: loop.autonomy === "idgaf",
          unanswered: loop.questions.filter((q) =>
            itemState?.unanswered?.includes(q.id),
          ),
        });
        loop = markDelivered(
          loop,
          answers.map((a) => a.id),
        );
        // The to-do's own model (TaskItem.model) wins over modeModels.loop;
        // one that is not configured falls back to it, noted on the run.
        // Without a loop entry the loop model is the selected one, or the
        // one a previous item's own model switched away from.
        const chatModels = state.config.config.modelsByRole.chat;
        const configured = chatModels.find(
          (m) =>
            m.title ===
            getModeModelTitle(
              state.config.config,
              "loop",
              state.ui.modeModelOverrides,
            ),
        );
        const modelBefore = loop.modelBefore;
        const loopModel =
          configured ??
          chatModels.find((m) => m.title === modelBefore) ??
          state.config.config.selectedModelByRole.chat ??
          undefined;
        const chosen = modelForLoopItem(item, chatModels, loopModel);
        loop = startItemRun(
          loop,
          action.itemId,
          state.session.history.length,
          now,
          { model: chosen.record },
        );
        // An own model leaves the loop model; the next turn comes back to it
        const leaves =
          !configured &&
          !!item.model &&
          !!chosen.model &&
          chosen.model.title !== loopModel?.title;
        loop = { ...loop, modelBefore: leaves ? loopModel?.title : undefined };
        dispatch(setMode("agent"));
        commitLoop(dispatch, getState, loop);
        await sendLoopTurn(dispatch, prompt, "loop", chosen.model?.title);
        return;
      }
      case "check":
        // The harness runs the item's check; no model turn
        commitLoop(dispatch, getState, loop);
        await runLoopCheck(dispatch, getState, extra.ideMessenger, action, now);
        return;
      case "replan": {
        let planTitle: string | undefined;
        if (state.session.planFile) {
          try {
            planTitle = parsePlanFile(
              await ide.readFile(state.session.planFile),
            ).title;
          } catch {
            // the prompt goes without a title
          }
        }
        // A round's re-plan, a check-in, or a repair of one failed item
        const replanTarget = replanReminderTarget(action);
        const taken = takeReminders(
          loop,
          replanTarget,
          await stampLoopFiles(ide, reminderPathsDue(loop, replanTarget)),
          now,
        );
        loop = taken.loop;
        const prompt = loopReplanTurnPrompt(action, {
          loop,
          plan,
          planFile,
          planTitle,
          reminders: taken.reminders,
        });
        loop = startReplan(loop, state.session.history.length, now, {
          plan,
          checkIn: action.checkIn,
          itemId: action.itemId,
        });
        // Without a re-plan entry, come back from an item's own model
        const back = getModeModelTitle(
          state.config.config,
          "replan",
          state.ui.modeModelOverrides,
        )
          ? undefined
          : loop.modelBefore;
        if (back) loop = { ...loop, modelBefore: undefined };
        dispatch(setMode("plan"));
        commitLoop(dispatch, getState, loop);
        await sendLoopTurn(dispatch, prompt, "replan", back);
        return;
      }
    }
  },
);
