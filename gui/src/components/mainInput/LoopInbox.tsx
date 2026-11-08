import { ArrowPathIcon } from "@heroicons/react/24/outline";
import type { LoopAutonomy, LoopQuestion } from "core";
import {
  formatLoopStatus,
  LOOP_AUTONOMY,
  LOOP_AUTONOMY_LEVELS,
  LOOP_LIMITS,
  standingInstructions,
} from "core/util/loopMode";
import { useState } from "react";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import {
  answerLoopQuestion,
  endLoopThunk,
  LoopAnswerInput,
  resumeLoopThunk,
  setLoopAutonomyThunk,
  stopLoopThunk,
} from "../../redux/thunks/loop";

const KIND_LABEL: Record<LoopQuestion["kind"], string> = {
  blocking: "Waiting on you",
  assumption: "Going on with a default",
  approval: "Needs your approval",
};

function QuestionRow({
  question,
  itemText,
  onAnswer,
}: {
  question: LoopQuestion;
  itemText?: string;
  onAnswer: (input: LoopAnswerInput) => Promise<string | undefined>;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const answer = async (input: Omit<LoopAnswerInput, "questionId">) => {
    const failed = await onAnswer({ ...input, questionId: question.id });
    setError(failed);
    if (!failed) setText("");
  };
  return (
    <li
      data-testid={`loop-question-${question.id}`}
      className="mt-1 rounded border border-solid border-border px-1.5 py-1"
    >
      <div className="text-2xs text-description-muted">
        {question.id} · {KIND_LABEL[question.kind]}
        {itemText ? ` · ${itemText}` : ""}
      </div>
      <div className="break-words text-foreground">{question.question}</div>
      {question.assumption && (
        <div className="break-words text-description">
          Assumed: {question.assumption}
        </div>
      )}
      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
        {question.kind === "approval" ? (
          <>
            <button
              type="button"
              data-testid="loop-approve"
              className="cursor-pointer rounded border border-solid border-border bg-transparent px-1.5 text-xs text-foreground hover:bg-input"
              onClick={() => void answer({ text: "", approve: true })}
            >
              Allow once
            </button>
            <button
              type="button"
              data-testid="loop-deny"
              className="cursor-pointer rounded border border-solid border-border bg-transparent px-1.5 text-xs text-foreground hover:bg-input"
              onClick={() => void answer({ text: text, approve: false })}
            >
              Don't allow
            </button>
          </>
        ) : (
          <>
            <input
              data-testid="loop-answer-input"
              value={text}
              maxLength={LOOP_LIMITS.maxAnswerLength}
              placeholder={
                question.kind === "assumption"
                  ? "Overrule with your answer"
                  : "Your answer"
              }
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && text.trim()) {
                  e.preventDefault();
                  void answer({ text });
                }
              }}
              className="min-w-0 flex-1 basis-32 rounded border border-solid border-border bg-input px-1 text-xs text-foreground placeholder:text-description-muted"
            />
            <button
              type="button"
              data-testid="loop-answer-send"
              disabled={!text.trim()}
              className="cursor-pointer rounded border border-solid border-border bg-transparent px-1.5 text-xs text-foreground hover:bg-input disabled:cursor-default disabled:opacity-50"
              onClick={() => void answer({ text })}
            >
              Answer
            </button>
            {question.kind === "assumption" && (
              <button
                type="button"
                data-testid="loop-confirm"
                className="cursor-pointer rounded border border-solid border-border bg-transparent px-1.5 text-xs text-foreground hover:bg-input"
                onClick={() => void answer({ text: "", confirm: true })}
              >
                Keep the default
              </button>
            )}
          </>
        )}
      </div>
      {error && (
        <div role="alert" className="mt-0.5 break-words text-error">
          {error}
        </div>
      )}
    </li>
  );
}

/**
 * Loop mode's inbox, above the input: where the loop is, the questions its
 * items hold, and a note about the whole plan. Answers can be given at any
 * time; the loop routes each one (core/util/loopMode.ts answerLoop).
 */
export function LoopInbox() {
  const dispatch = useAppDispatch();
  const loop = useAppSelector((s) => s.session.loop);
  const taskPlan = useAppSelector((s) => s.session.taskPlan);
  const [note, setNote] = useState("");
  const [replanNow, setReplanNow] = useState(false);
  const [standing, setStanding] = useState(false);
  const [noteError, setNoteError] = useState<string>();
  if (!loop) return null;

  const open = loop.questions.filter((q) => !q.answerId);
  const standingNotes = standingInstructions(loop);
  const itemText = (id?: string) =>
    taskPlan?.items.find((i) => i.id === id)?.text;
  const onAnswer = async (input: LoopAnswerInput) => {
    const result = await dispatch(answerLoopQuestion(input)).unwrap();
    return result.ok ? undefined : result.error;
  };
  const stopped = loop.status === "stopped";

  return (
    <div
      data-testid="loop-inbox"
      className="mx-1 mb-1 min-w-0 rounded border border-solid border-border px-2 py-1 text-xs"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        <ArrowPathIcon className="h-3 w-3 shrink-0 text-description" />
        <span
          data-testid="loop-status"
          className="min-w-0 flex-1 basis-40 break-words text-description"
        >
          Loop · {formatLoopStatus(loop, { level: false })}
        </span>
        <select
          data-testid="loop-autonomy"
          value={loop.autonomy ?? "auto"}
          title={LOOP_AUTONOMY[loop.autonomy ?? "auto"].description}
          onChange={(e) =>
            void dispatch(setLoopAutonomyThunk(e.target.value as LoopAutonomy))
          }
          className="shrink-0 cursor-pointer rounded border border-solid border-border bg-input px-1 text-xs text-foreground"
        >
          {LOOP_AUTONOMY_LEVELS.map((level) => (
            <option key={level} value={level}>
              {LOOP_AUTONOMY[level].label}
            </option>
          ))}
        </select>
        {stopped ? (
          <>
            {loop.stopReason !== "done" && (
              <button
                type="button"
                data-testid="loop-resume"
                className="shrink-0 cursor-pointer border-none bg-transparent p-0 text-xs text-link hover:underline"
                onClick={() => void dispatch(resumeLoopThunk())}
              >
                Resume
              </button>
            )}
            <button
              type="button"
              data-testid="loop-end"
              className="shrink-0 cursor-pointer border-none bg-transparent p-0 text-xs text-description-muted hover:text-foreground"
              onClick={() => void dispatch(endLoopThunk())}
            >
              Close
            </button>
          </>
        ) : (
          <button
            type="button"
            data-testid="loop-stop"
            title="Stop after the running item (Stop in the input stops it now)"
            className="shrink-0 cursor-pointer border-none bg-transparent p-0 text-xs text-link hover:underline"
            onClick={() => void dispatch(stopLoopThunk())}
          >
            Stop loop
          </button>
        )}
      </div>
      {loop.status === "awaiting_plan" && loop.replanReason && (
        <div
          data-testid="loop-replan-reason"
          className="mt-0.5 text-description"
        >
          New plan waiting on its card: {loop.replanReason}
        </div>
      )}
      {open.length > 0 && (
        <ul className="m-0 max-h-64 list-none overflow-y-auto p-0">
          {open.map((q) => (
            <QuestionRow
              key={q.id}
              question={q}
              itemText={itemText(q.itemId)}
              onAnswer={onAnswer}
            />
          ))}
        </ul>
      )}
      {standingNotes.length > 0 && (
        <ul
          data-testid="loop-standing-list"
          className="m-0 mt-1 list-none p-0 text-description"
        >
          {standingNotes.map((text, i) => (
            <li key={i} className="break-words">
              For every item: {text}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
        <input
          data-testid="loop-plan-note"
          value={note}
          maxLength={LOOP_LIMITS.maxAnswerLength}
          placeholder="A note about the whole plan (read at the next re-plan, or by every item)"
          onChange={(e) => setNote(e.target.value)}
          className="min-w-0 flex-1 basis-40 rounded border border-solid border-border bg-transparent px-1 text-xs text-foreground placeholder:text-description-muted"
        />
        <label className="flex shrink-0 items-center gap-0.5 text-description">
          <input
            type="checkbox"
            data-testid="loop-replan-now"
            checked={replanNow}
            onChange={(e) => {
              setReplanNow(e.target.checked);
              if (e.target.checked) setStanding(false);
            }}
          />
          Re-plan now
        </label>
        <label
          className="flex shrink-0 items-center gap-0.5 text-description"
          title="Send this with every item from now on, instead of waiting for the re-plan"
        >
          <input
            type="checkbox"
            data-testid="loop-standing"
            checked={standing}
            onChange={(e) => {
              setStanding(e.target.checked);
              if (e.target.checked) setReplanNow(false);
            }}
          />
          For every item
        </label>
        <button
          type="button"
          data-testid="loop-plan-note-send"
          disabled={!note.trim()}
          className="shrink-0 cursor-pointer rounded border border-solid border-border bg-transparent px-1.5 text-xs text-foreground hover:bg-input disabled:cursor-default disabled:opacity-50"
          onClick={async () => {
            const failed = await onAnswer({ text: note, replanNow, standing });
            setNoteError(failed);
            if (!failed) {
              setNote("");
              setReplanNow(false);
              setStanding(false);
            }
          }}
        >
          Add
        </button>
      </div>
      {noteError && (
        <div role="alert" className="mt-0.5 break-words text-error">
          {noteError}
        </div>
      )}
    </div>
  );
}
