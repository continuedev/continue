import type {
  LoopCheckResult,
  LoopItemModel,
  LoopState,
  TaskItem,
  TaskPlan,
} from "core";
import {
  blockingDependencies,
  describeLoopBudget,
  describeLoopReplan,
  loopReplanSetting,
  LoopReplanSetting,
  maxRoundsForReplan,
  unmetDependencies,
} from "core/util/loopMode";
import { useEffect, useState } from "react";
import { useAppDispatch } from "../../redux/hooks";
import {
  runLoopItemAgainThunk,
  setLoopBudgetThunk,
  skipLoopItemThunk,
} from "../../redux/thunks/loop";

const BUTTON =
  "shrink-0 cursor-pointer rounded border border-solid border-border bg-transparent px-1.5 text-xs text-foreground hover:bg-input";
const FIELD =
  "w-20 rounded border border-solid border-border bg-input px-1 text-xs text-foreground";

function statusLabel(loop: LoopState, itemId: string): string {
  const state = loop.items.find((i) => i.id === itemId);
  if (!state) return "";
  if (state.skipped) return "skipped";
  if (state.again && state.status === "pending") return "to run again";
  switch (state.status) {
    case "checking":
      return loop.current?.kind === "check" && loop.current.itemId === itemId
        ? "checking"
        : "check waits";
    case "pending":
    case "redo":
    case "running":
    case "done":
    case "waiting":
    case "failed":
      return state.status;
  }
}

/** What the item comes after, while it waits for it: "after 1" or "blocked on 1". */
function dependencyLabel(
  loop: LoopState,
  taskPlan: TaskPlan,
  task: TaskItem,
): string | undefined {
  const state = loop.items.find((i) => i.id === task.id);
  if (state?.status !== "pending" && state?.status !== "redo") return;
  if (state.skipped) return;
  const blocked = blockingDependencies(loop, taskPlan, task);
  if (blocked.length) return `blocked on ${blocked.join(", ")}`;
  const unmet = unmetDependencies(loop, taskPlan, task);
  return unmet.length ? `after ${unmet.join(", ")}` : undefined;
}

const CHECK_LABEL: Record<LoopCheckResult["status"], string> = {
  passed: "check passed",
  failed: "check failed",
  refused: "check not run",
};

/** The item's check and its last result, with a failure's output. */
function CheckLine({
  task,
  check,
}: {
  task: TaskItem;
  check?: LoopCheckResult;
}) {
  if (!task.check && !check) return null;
  return (
    <div
      data-testid={`loop-check-${task.id}`}
      className="ml-3 min-w-0 text-2xs text-description-muted"
    >
      <div className="truncate" title={task.check ?? check?.command}>
        check: <code>{task.check ?? check?.command}</code>
        {check && (
          <span
            data-testid={`loop-check-result-${task.id}`}
            className={check.status === "failed" ? "text-error" : undefined}
          >
            {" "}
            · {CHECK_LABEL[check.status]}
            {check.status === "refused" && check.output
              ? `: ${check.output}`
              : ""}
          </span>
        )}
      </div>
      {check?.status === "failed" && check.output && (
        <pre
          data-testid={`loop-check-output-${task.id}`}
          className="m-0 max-h-16 overflow-auto break-words whitespace-pre-wrap"
        >
          {check.output.trim()}
        </pre>
      )}
    </div>
  );
}

/**
 * The model the to-do names (TaskItem.model) and, once a run started, the one
 * it went to when that was not it: the item's own model is not configured.
 */
function ModelLine({ task, model }: { task: TaskItem; model?: LoopItemModel }) {
  if (!task.model) return null;
  return (
    <div
      data-testid={`loop-model-${task.id}`}
      className="ml-3 min-w-0 truncate text-2xs text-description-muted"
      title={model?.fallbackReason ?? "The model this item runs with"}
    >
      model: {task.model}
      {model?.fallbackReason && (
        <span
          data-testid={`loop-model-fallback-${task.id}`}
          className="text-warning"
        >
          {" "}
          · not configured, ran on {model.title}
        </span>
      )}
    </div>
  );
}

/** The limits as the editor's fields: rounds, tokens, minutes (0: no limit). */
function draftOf(loop: LoopState) {
  return {
    rounds: String(loop.budget.maxRounds),
    tokens: String(loop.budget.maxTokens),
    minutes: String(Math.round(loop.budget.maxWallMs / 60000)),
  };
}

/**
 * The loop's controls, under its status in the inbox: skip an item or run it
 * again, how often to re-plan, and the limits. Every decision and bound is
 * core's (skipItem, runItemAgain, setLoopBudget); a refusal shows here.
 */
export function LoopControls({
  loop,
  taskPlan,
}: {
  loop: LoopState;
  taskPlan?: TaskPlan;
}) {
  const dispatch = useAppDispatch();
  const [error, setError] = useState<string>();
  const [draft, setDraft] = useState(() => draftOf(loop));
  const { maxRounds, maxTokens, maxWallMs } = loop.budget;
  useEffect(() => setDraft(draftOf(loop)), [maxRounds, maxTokens, maxWallMs]);

  const report = (result: { ok: boolean; error?: string }) =>
    setError(result.ok ? undefined : result.error);
  const setReplan = async (setting: LoopReplanSetting) =>
    report(
      await dispatch(
        setLoopBudgetThunk({ maxRounds: maxRoundsForReplan(loop, setting) }),
      ).unwrap(),
    );
  const replan = loopReplanSetting(loop);

  return (
    <details data-testid="loop-controls" className="mt-1 text-description">
      <summary className="cursor-pointer">
        Items and limits · {describeLoopReplan(loop)}
      </summary>
      {taskPlan && (
        <ul className="m-0 mt-1 max-h-48 list-none overflow-y-auto p-0">
          {taskPlan.items.map((task) => {
            const state = loop.items.find((i) => i.id === task.id);
            if (!state) return null;
            const checkRunning =
              loop.current?.kind === "check" && loop.current.itemId === task.id;
            const canSkip =
              state.status !== "running" &&
              state.status !== "done" &&
              !checkRunning;
            const canAgain =
              state.status === "done" || state.status === "failed";
            const dependency = dependencyLabel(loop, taskPlan, task);
            return (
              <li key={task.id} className="min-w-0">
                <div
                  data-testid={`loop-item-${task.id}`}
                  className="flex min-w-0 items-center gap-1"
                >
                  <span className="min-w-0 flex-1 truncate text-foreground">
                    {task.id}. {task.text}
                  </span>
                  {dependency && (
                    <span
                      data-testid={`loop-after-${task.id}`}
                      className="shrink-0 text-description-muted"
                    >
                      {dependency}
                    </span>
                  )}
                  <span className="shrink-0 text-description-muted">
                    {statusLabel(loop, task.id)}
                  </span>
                  {canSkip && (
                    <button
                      type="button"
                      data-testid={`loop-skip-${task.id}`}
                      className={BUTTON}
                      onClick={async () =>
                        report(
                          await dispatch(skipLoopItemThunk(task.id)).unwrap(),
                        )
                      }
                    >
                      Skip
                    </button>
                  )}
                  {canAgain && (
                    <button
                      type="button"
                      data-testid={`loop-again-${task.id}`}
                      className={BUTTON}
                      onClick={async () =>
                        report(
                          await dispatch(
                            runLoopItemAgainThunk(task.id),
                          ).unwrap(),
                        )
                      }
                    >
                      Run again
                    </button>
                  )}
                </div>
                <CheckLine task={task} check={state.check} />
                <ModelLine task={task} model={state.model} />
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
        <label className="flex shrink-0 items-center gap-0.5">
          Re-plan
          <select
            data-testid="loop-replan"
            value={replan.kind}
            onChange={(e) => {
              const kind = e.target.value as LoopReplanSetting["kind"];
              void setReplan(
                kind === "up_to"
                  ? { kind, replans: Math.max(1, maxRounds - 1) }
                  : { kind },
              );
            }}
            className="cursor-pointer rounded border border-solid border-border bg-input px-1 text-xs text-foreground"
          >
            <option value="never">never</option>
            <option value="up_to">up to N times</option>
            <option value="until_done">until done</option>
          </select>
        </label>
        {replan.kind === "up_to" && (
          <input
            type="number"
            data-testid="loop-replan-count"
            min={1}
            value={replan.replans}
            onChange={(e) => {
              const replans = Number(e.target.value);
              // An emptied field is not "never"; wait for a number
              if (replans >= 1) void setReplan({ kind: "up_to", replans });
            }}
            className={FIELD}
          />
        )}
      </div>
      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
        {(
          [
            ["rounds", "Rounds"],
            ["tokens", "Tokens (0: none)"],
            ["minutes", "Minutes (0: none)"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex shrink-0 items-center gap-0.5">
            {label}
            <input
              type="number"
              data-testid={`loop-limit-${key}`}
              min={0}
              value={draft[key]}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              className={FIELD}
            />
          </label>
        ))}
        <button
          type="button"
          data-testid="loop-limits-apply"
          className={BUTTON}
          title={describeLoopBudget(loop.budget)}
          onClick={async () =>
            report(
              await dispatch(
                setLoopBudgetThunk({
                  maxRounds: Number(draft.rounds),
                  maxTokens: Number(draft.tokens),
                  maxWallMs: Math.round(Number(draft.minutes) * 60000),
                }),
              ).unwrap(),
            )
          }
        >
          Apply
        </button>
      </div>
      {error && (
        <div
          role="alert"
          data-testid="loop-controls-error"
          className="mt-0.5 break-words text-error"
        >
          {error}
        </div>
      )}
    </details>
  );
}
