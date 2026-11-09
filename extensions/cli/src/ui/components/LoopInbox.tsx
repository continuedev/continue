import type {
  LoopQuestion,
  LoopState,
  TaskItem,
  TaskPlan,
} from "core/index.js";
import {
  formatLoopStatus,
  taskPlanWithLoop,
  LOOP_AUTONOMY,
  LOOP_AUTONOMY_LEVELS,
  LOOP_STRATEGIES,
  LOOP_STRATEGY_ORDER,
  loopStrategy,
  standingInstructions,
} from "core/util/loopMode.js";
import { TASK_STATUS_MARKERS } from "core/util/taskPlan.js";
import { Box, Text, useInput } from "ink";
import React, { useEffect, useState } from "react";

import {
  acceptLoopPlan,
  answerLoopQuestion,
  requestLoopStop,
  resumeStoppedLoop,
  setRunningLoopAutonomy,
  setRunningLoopStrategy,
} from "../../loop/loopSession.js";
import {
  getSessionLoop,
  getSessionTaskPlan,
  onLoopChange,
} from "../../session.js";
import { defaultBoxStyles } from "../styles.js";

import { ChecklistDisplay } from "./ChecklistDisplay.js";
import {
  applyLimitsText,
  limitsDraft,
  loopControlActions,
  loopControlLabel,
  runLoopControl,
  type LoopControlAction,
} from "./loopControls.js";
import { useTaskPlan } from "./TaskProgressStrip.js";

/** The session's loop, re-rendering when it changes. */
export function useLoopState(): LoopState | undefined {
  const [loop, setLoop] = useState<LoopState | undefined>(() => {
    try {
      return getSessionLoop();
    } catch {
      return undefined;
    }
  });
  useEffect(() => onLoopChange(setLoop), []);
  return loop;
}

/**
 * One line above the prompt while the session has a loop: its state, and
 * how to open the inbox when there is something to answer.
 */
export const LoopStrip: React.FC = () => {
  const loop = useLoopState();
  const plan = useTaskPlan();
  if (!loop) return null;
  const open = loop.questions.some((q) => !q.answerId);
  const needsYou =
    open || loop.status === "awaiting_plan" || loop.status === "stopped";
  return (
    <Box flexDirection="column" paddingBottom={plan ? 1 : 0}>
      <Box paddingLeft={1}>
        <Text wrap="truncate-end">
          <Text color="dim">Loop </Text>
          <Text color={needsYou ? "yellow" : "dim"}>
            {needsYou ? "(/loop to answer)" : "(/loop)"}
          </Text>
          <Text color={needsYou ? "yellow" : "cyan"}>
            {" "}
            {formatLoopStatus(loop)}
          </Text>
        </Text>
      </Box>
      {plan && (
        <ChecklistDisplay
          content={loopChecklist(loop, plan, { compact: true })}
        />
      )}
    </Box>
  );
};

/** How many lines the checklist above the prompt shows before folding. */
export const LOOP_CHECKLIST_LINES = 8;

/**
 * The loop's items as a checklist (the task list's markers): what the TUI
 * shows above the prompt while a loop runs, and in full in the inbox.
 * Compact folds the finished items but the last into a count and shows the
 * next open items up to LOOP_CHECKLIST_LINES, with notes only for items
 * that wait on the person or failed. In full, every item has its note (what
 * its run reported, or the questions it waits on) and the model its to-do
 * names (TaskItem.model).
 */
export function loopChecklist(
  loop: LoopState,
  plan: TaskPlan,
  { compact = false }: { compact?: boolean } = {},
): string {
  const items: TaskItem[] = taskPlanWithLoop(plan, loop).items;
  const line = (item: TaskItem) => {
    const showNote = !!item.note && (!compact || item.status === "blocked");
    const model = !compact && item.model ? ` [model: ${item.model}]` : "";
    return `- ${TASK_STATUS_MARKERS[item.status]} ${item.text}${model}${showNote ? ` (${item.note})` : ""}`;
  };
  if (!compact) return items.map(line).join("\n");

  const finished = items.filter(
    (i) => i.status === "completed" || i.status === "cancelled",
  );
  const folded = new Set(finished.slice(0, -1).map((i) => i.id));
  const shown = items.filter((i) => !folded.has(i.id));
  const lines: string[] = [];
  if (folded.size > 0) {
    lines.push(
      `${folded.size} earlier item${folded.size === 1 ? "" : "s"} done`,
    );
  }
  const room = Math.max(1, LOOP_CHECKLIST_LINES - lines.length);
  for (const item of shown.slice(0, room)) lines.push(line(item));
  if (shown.length > room) lines.push(`… ${shown.length - room} more`);
  return lines.join("\n");
}

type InboxAction =
  | { kind: "answer"; question: LoopQuestion }
  | { kind: "confirm"; question: LoopQuestion }
  | { kind: "approve"; question: LoopQuestion; approve: boolean }
  | { kind: "note" }
  | { kind: "continue" }
  | { kind: "resume" }
  | { kind: "level" }
  | { kind: "strategy" }
  | { kind: "stop" }
  | { kind: "control"; control: LoopControlAction }
  | { kind: "close" };

type InboxMode =
  | { kind: "menu" }
  | { kind: "text"; question?: LoopQuestion; limits?: boolean }
  | { kind: "planRoute"; text: string };

const PLAN_ROUTES = [
  { label: "Read it at the next re-plan", input: {} },
  { label: "Re-plan now (after the running item)", input: { replanNow: true } },
  { label: "For every item from now on", input: { standing: true } },
] as const;

function itemText(itemId: string | undefined): string | undefined {
  if (!itemId) return undefined;
  return getSessionTaskPlan()?.items.find((i) => i.id === itemId)?.text;
}

function actionLabel(action: InboxAction, loop: LoopState): string {
  switch (action.kind) {
    case "answer":
      return `Answer ${action.question.id}`;
    case "confirm":
      return `Keep the default (${action.question.id})`;
    case "approve":
      return action.approve
        ? `Allow once (${action.question.id})`
        : `Don't allow (${action.question.id})`;
    case "note":
      return "Write a note about the plan";
    case "continue":
      return "Continue the loop with the new plan";
    case "resume":
      return "Resume the loop";
    case "level":
      return `Level: ${LOOP_AUTONOMY[loop.autonomy ?? "auto"].label} (Enter to change)`;
    case "strategy":
      return `Strategy: ${LOOP_STRATEGIES[loopStrategy(loop)].label} (Enter to change)`;
    case "stop":
      return "Stop after this item";
    case "control":
      return loopControlLabel(action.control, loop, getSessionTaskPlan());
    case "close":
      return "Close";
  }
}

function inboxActions(loop: LoopState): InboxAction[] {
  const actions: InboxAction[] = [];
  for (const question of loop.questions.filter((q) => !q.answerId)) {
    if (question.kind === "approval") {
      actions.push({ kind: "approve", question, approve: true });
      actions.push({ kind: "approve", question, approve: false });
    } else if (question.kind === "assumption") {
      actions.push({ kind: "confirm", question });
    }
    actions.push({ kind: "answer", question });
  }
  actions.push({ kind: "note" });
  if (loop.status === "awaiting_plan") actions.push({ kind: "continue" });
  if (loop.status === "stopped") actions.push({ kind: "resume" });
  actions.push({ kind: "level" });
  actions.push({ kind: "strategy" });
  const controls = loopControlActions(loop, getSessionTaskPlan()).map(
    (control) => ({ kind: "control" as const, control }),
  );
  const stopNow = controls.filter((c) => c.control.kind === "stopNow");
  actions.push(...controls.filter((c) => c.control.kind !== "stopNow"));
  if (loop.status !== "stopped" && !loop.stopRequested) {
    actions.push({ kind: "stop" });
  }
  actions.push(...stopNow);
  actions.push({ kind: "close" });
  return actions;
}

const KIND_LABEL: Record<LoopQuestion["kind"], string> = {
  assumption: "assumption",
  blocking: "blocking",
  approval: "approval",
};

/**
 * Loop mode's inbox (`/loop`): the open questions, answered while the loop
 * goes on. Core routes each answer by the state of its item; a note with no
 * item is about the plan, read at the next re-plan, at once ("Re-plan now"),
 * or sent with every item ("For every item"). The level and strategy
 * pickers, the controls (loopControls.ts) and Stop after this item are
 * here too; `onStopNow` aborts the running turn, as Esc does.
 */
export const LoopInbox: React.FC<{
  onClose: () => void;
  onStopNow?: () => void;
}> = ({ onClose, onStopNow }) => {
  const loop = useLoopState();
  const plan = useTaskPlan();
  const [mode, setMode] = useState<InboxMode>({ kind: "menu" });
  const [selected, setSelected] = useState(0);
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<string | undefined>();

  const actions = loop ? inboxActions(loop) : [];
  const index = Math.min(selected, Math.max(0, actions.length - 1));

  const report = (result: { ok: boolean; error?: string; route?: string }) => {
    setFeedback(
      result.ok
        ? `Answer recorded${result.route ? ` (${result.route})` : ""}.`
        : result.error,
    );
  };

  const run = (action: InboxAction) => {
    switch (action.kind) {
      case "answer":
        setText("");
        setMode({ kind: "text", question: action.question });
        return;
      case "note":
        setText("");
        setMode({ kind: "text" });
        return;
      case "confirm":
        report(
          answerLoopQuestion({
            questionId: action.question.id,
            text: "",
            confirm: true,
          }),
        );
        return;
      case "approve":
        report(
          answerLoopQuestion({
            questionId: action.question.id,
            text: "",
            approve: action.approve,
          }),
        );
        return;
      case "continue":
        setFeedback(
          acceptLoopPlan() ? "The next round starts." : "No plan to continue.",
        );
        return;
      case "resume":
        setFeedback(resumeStoppedLoop() ? "Resumed." : "Nothing to resume.");
        return;
      case "level": {
        const current = loop?.autonomy ?? "auto";
        const next =
          LOOP_AUTONOMY_LEVELS[
            (LOOP_AUTONOMY_LEVELS.indexOf(current) + 1) %
              LOOP_AUTONOMY_LEVELS.length
          ];
        setRunningLoopAutonomy(next);
        setFeedback(LOOP_AUTONOMY[next].description);
        return;
      }
      case "strategy": {
        if (!loop) return;
        const order = LOOP_STRATEGY_ORDER;
        const next =
          order[(order.indexOf(loopStrategy(loop)) + 1) % order.length];
        setRunningLoopStrategy(next);
        setFeedback(LOOP_STRATEGIES[next].description);
        return;
      }
      case "stop":
        requestLoopStop();
        setFeedback("The loop stops after the running step.");
        return;
      case "control":
        if (action.control.kind === "limits") {
          setText(loop ? limitsDraft(loop) : "");
          setMode({ kind: "text", limits: true });
          return;
        }
        if (loop) setFeedback(runLoopControl(action.control, loop, onStopNow));
        return;
      case "close":
        onClose();
        return;
    }
  };

  useInput((input, key) => {
    if (mode.kind === "text") {
      if (key.escape) {
        setMode({ kind: "menu" });
        return;
      }
      if (key.return) {
        const answer = text.trim();
        if (!answer) return;
        if (mode.limits) {
          setFeedback(applyLimitsText(text));
          setMode({ kind: "menu" });
        } else if (mode.question) {
          report(answerLoopQuestion({ questionId: mode.question.id, text }));
          setMode({ kind: "menu" });
        } else {
          setSelected(0);
          setMode({ kind: "planRoute", text });
        }
        return;
      }
      if (key.backspace || key.delete) {
        setText((t) => t.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) setText((t) => t + input);
      return;
    }

    const count =
      mode.kind === "planRoute" ? PLAN_ROUTES.length : actions.length;
    if (key.escape) {
      if (mode.kind === "planRoute") setMode({ kind: "menu" });
      else onClose();
      return;
    }
    if (key.upArrow) {
      setSelected((i) => (i <= 0 ? count - 1 : i - 1));
      return;
    }
    if (key.downArrow) {
      setSelected((i) => (i >= count - 1 ? 0 : i + 1));
      return;
    }
    if (key.return) {
      if (mode.kind === "planRoute") {
        const route = PLAN_ROUTES[Math.min(selected, count - 1)];
        report(answerLoopQuestion({ text: mode.text, ...route.input }));
        setSelected(0);
        setMode({ kind: "menu" });
        return;
      }
      const action = actions[index];
      if (action) run(action);
    }
  });

  if (!loop) {
    return (
      <Box {...defaultBoxStyles("cyan")}>
        <Text>
          No loop in this session. Choose "Build in a loop" on a plan.
        </Text>
        <Text color="dim">Esc to close</Text>
      </Box>
    );
  }

  const open = loop.questions.filter((q) => !q.answerId);
  const standing = standingInstructions(loop);

  return (
    <Box {...defaultBoxStyles("cyan")} flexDirection="column" marginBottom={1}>
      <Text bold>Loop · {formatLoopStatus(loop)}</Text>
      {loop.status === "awaiting_plan" && loop.replanReason && (
        <Text color="yellow">
          A new plan waits for you: {loop.replanReason}
        </Text>
      )}

      {plan && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="dim">Plan</Text>
          <ChecklistDisplay content={loopChecklist(loop, plan)} />
        </Box>
      )}

      <Box flexDirection="column" marginTop={1}>
        {open.length === 0 ? (
          <Text color="dim">No open questions.</Text>
        ) : (
          open.map((q) => {
            const item = itemText(q.itemId);
            return (
              <Box key={q.id} flexDirection="column" marginBottom={1}>
                <Text>
                  <Text color="magenta" bold>
                    {q.id}
                  </Text>{" "}
                  <Text color="dim">[{KIND_LABEL[q.kind]}]</Text>
                  {item ? <Text color="dim"> {item}</Text> : null}
                </Text>
                <Text>{q.question}</Text>
                {q.assumption && (
                  <Text color="dim">Assumed: {q.assumption}</Text>
                )}
              </Box>
            );
          })
        )}
      </Box>

      {standing.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="dim">For every item:</Text>
          {standing.map((s, i) => (
            <Text key={i} color="dim">
              {"  "}- {s}
            </Text>
          ))}
        </Box>
      )}

      {mode.kind === "text" && (
        <Box flexDirection="column">
          <Text>
            {mode.limits
              ? "Limits: rounds, tokens and minutes (0: no limit):"
              : mode.question
                ? `Your answer to ${mode.question.id}:`
                : "Your note about the plan:"}
          </Text>
          <Box>
            <Text color="cyan">❯ </Text>
            <Text>{text}</Text>
            <Text color="gray">▊</Text>
          </Box>
          <Text color="dim">Enter to send · Esc to go back</Text>
        </Box>
      )}

      {mode.kind === "planRoute" && (
        <Box flexDirection="column">
          <Text>When should the loop use this note?</Text>
          {PLAN_ROUTES.map((route, i) => (
            <Text
              key={route.label}
              color={i === selected ? "cyan" : undefined}
              bold={i === selected}
            >
              {i === selected ? "❯ " : "  "}
              {route.label}
            </Text>
          ))}
        </Box>
      )}

      {mode.kind === "menu" && (
        <Box flexDirection="column">
          {actions.map((action, i) => (
            <Text
              key={`${action.kind}-${i}`}
              color={i === index ? "cyan" : undefined}
              bold={i === index}
            >
              {i === index ? "❯ " : "  "}
              {actionLabel(action, loop)}
            </Text>
          ))}
          <Text color="dim">↑/↓ to move · Enter to choose · Esc to close</Text>
        </Box>
      )}

      {feedback && <Text color="green">{feedback}</Text>}
    </Box>
  );
};
