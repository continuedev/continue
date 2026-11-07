import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import type { TaskItem, TaskPlan, TaskStatus } from "core";
import {
  buildTaskPlan,
  formatTaskProgress,
  TASK_PLAN_LIMITS,
  TASK_STATUS_MARKERS,
} from "core/util/taskPlan";
import { useState, type KeyboardEvent } from "react";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { setTaskPlan } from "../../redux/slices/sessionSlice";
import { saveCurrentSession } from "../../redux/thunks/session";

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  blocked: "Blocked",
};

/** What a click on the marker moves an item to. */
const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  pending: "in_progress",
  in_progress: "completed",
  completed: "pending",
  blocked: "pending",
  cancelled: "pending",
};

/**
 * Applies an edit made by the person. Their edit wins at once: the list is
 * stored as they left it and marked as edited by the user, and the next
 * request tells the model so (see formatTaskPlanBlock).
 */
export function applyUserEdit(
  plan: TaskPlan | undefined,
  items: Array<Partial<TaskItem> & { text: string }>,
): TaskPlan | undefined | string {
  // Keep the single-in-progress rule: the item just set wins.
  const result = buildTaskPlan(items, {
    previous: plan,
    reset: true,
    updatedBy: "user",
  });
  if (!result.ok) {
    return result.error;
  }
  return result.plan.items.length ? result.plan : undefined;
}

function TaskRow(props: {
  item: TaskItem;
  onStatus: () => void;
  onText: (text: string) => void;
  onDelete: () => void;
}) {
  const { item } = props;
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const done = item.status === "completed" || item.status === "cancelled";
  const active = item.status === "in_progress";

  const commit = () => {
    if (draft !== undefined && draft.trim() && draft.trim() !== item.text) {
      props.onText(draft.trim());
    }
    setDraft(undefined);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDraft(undefined);
    }
  };

  return (
    <li
      data-testid={`task-item-${item.id}`}
      data-status={item.status}
      className="group flex min-w-0 items-start gap-1.5 py-0.5"
    >
      <button
        type="button"
        data-testid={`task-status-${item.id}`}
        title={`${STATUS_LABEL[item.status]}. Click to mark ${STATUS_LABEL[NEXT_STATUS[item.status]].toLowerCase()}.`}
        aria-label={`${STATUS_LABEL[item.status]}: ${item.text}`}
        onClick={props.onStatus}
        className={`shrink-0 cursor-pointer border-none bg-transparent p-0 font-mono text-xs ${
          active
            ? "text-link"
            : item.status === "blocked"
              ? "text-warning"
              : "text-description-muted"
        } hover:text-foreground`}
      >
        {TASK_STATUS_MARKERS[item.status]}
      </button>
      {draft !== undefined ? (
        <input
          data-testid={`task-input-${item.id}`}
          autoFocus
          value={draft}
          maxLength={TASK_PLAN_LIMITS.maxTextLength}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          aria-label="Edit task"
          className="min-w-0 flex-1 rounded border border-solid border-border bg-input px-1 text-xs text-foreground"
        />
      ) : (
        <span
          data-testid={`task-text-${item.id}`}
          role="button"
          tabIndex={0}
          title="Click to edit"
          onClick={() => setDraft(item.text)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setDraft(item.text);
            }
          }}
          className={`min-w-0 flex-1 cursor-text text-xs break-words ${
            done
              ? "text-description-muted line-through"
              : active
                ? "font-medium text-foreground"
                : "text-description"
          }`}
        >
          {active && item.activeForm ? item.activeForm : item.text}
          {item.note &&
            (item.status === "blocked" || item.status === "cancelled") && (
              <span className="text-description-muted"> ({item.note})</span>
            )}
        </span>
      )}
      <button
        type="button"
        data-testid={`task-delete-${item.id}`}
        aria-label={`Remove ${item.text}`}
        title="Remove"
        onClick={props.onDelete}
        className="shrink-0 cursor-pointer border-none bg-transparent p-0 text-xs text-description-muted opacity-0 group-hover:opacity-100 hover:text-foreground focus:opacity-100"
      >
        ×
      </button>
    </li>
  );
}

/**
 * The agent's task list above the input: a one-line progress summary
 * ("3/8 Running migrations") that expands to the editable list. The list
 * belongs to the session and is saved with it.
 */
export function TaskListPanel() {
  const dispatch = useAppDispatch();
  const plan = useAppSelector((s) => s.session.taskPlan);
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  if (!plan?.items.length) {
    return null;
  }

  const update = (items: Array<Partial<TaskItem> & { text: string }>) => {
    const next = applyUserEdit(plan, items);
    if (typeof next === "string") {
      setError(next);
      return;
    }
    setError(undefined);
    dispatch(setTaskPlan(next));
    void dispatch(
      saveCurrentSession({ openNewSession: false, generateTitle: false }),
    );
  };

  const setStatus = (id: string) => {
    const target = plan.items.find((i) => i.id === id);
    if (!target) return;
    const status = NEXT_STATUS[target.status];
    update(
      plan.items.map((i) =>
        i.id === id
          ? { ...i, status }
          : status === "in_progress" && i.status === "in_progress"
            ? { ...i, status: "pending" as const }
            : i,
      ),
    );
  };

  const progress = formatTaskProgress(plan);
  const ListIcon = expanded ? ChevronDownIcon : ChevronRightIcon;

  return (
    <div
      data-testid="task-list-panel"
      className="mx-1 mb-1 min-w-0 rounded border border-solid border-border px-2 py-1 text-xs"
    >
      <div className="flex min-w-0 items-start gap-1">
        <button
          type="button"
          data-testid="task-list-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          className="flex min-w-0 flex-1 cursor-pointer items-start gap-1 border-none bg-transparent p-0 text-left text-xs text-description hover:text-foreground"
        >
          <ListIcon className="mt-0.5 h-3 w-3 shrink-0" />
          <span
            data-testid="task-list-progress"
            className="min-w-0 break-words"
          >
            {progress}
          </span>
        </button>
        {expanded && (
          <button
            type="button"
            data-testid="task-list-clear"
            title="Remove the task list"
            onClick={() => update([])}
            className="shrink-0 cursor-pointer border-none bg-transparent p-0 text-xs text-description-muted hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>
      {expanded && (
        <>
          <ul className="m-0 mt-1 max-h-48 list-none overflow-y-auto p-0">
            {plan.items.map((item) => (
              <TaskRow
                key={item.id}
                item={item}
                onStatus={() => setStatus(item.id)}
                onText={(text) =>
                  update(
                    plan.items.map((i) =>
                      i.id === item.id ? { ...i, text } : i,
                    ),
                  )
                }
                onDelete={() =>
                  update(plan.items.filter((i) => i.id !== item.id))
                }
              />
            ))}
          </ul>
          {plan.items.length < TASK_PLAN_LIMITS.maxItems && (
            <input
              data-testid="task-list-add"
              value={adding}
              maxLength={TASK_PLAN_LIMITS.maxTextLength}
              placeholder="Add a task"
              aria-label="Add a task"
              onChange={(e) => setAdding(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && adding.trim()) {
                  e.preventDefault();
                  update([...plan.items, { text: adding.trim() }]);
                  setAdding("");
                }
              }}
              className="mt-1 w-full min-w-0 rounded border border-solid border-border bg-transparent px-1 text-xs text-foreground placeholder:text-description-muted"
            />
          )}
          {error && (
            <div role="alert" className="mt-1 break-words text-error">
              {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}
