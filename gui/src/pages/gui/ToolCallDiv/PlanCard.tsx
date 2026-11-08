import { ClipboardDocumentListIcon } from "@heroicons/react/24/outline";
import { ToolCallState } from "core";
import { validatePlanArgs, type PlanDecision } from "core/util/planFile";
import { useContext, useState } from "react";
import { useMainEditor } from "../../../components/mainInput/TipTapEditor";
import StyledMarkdownPreview from "../../../components/StyledMarkdownPreview";
import { Button } from "../../../components/ui";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { setMode } from "../../../redux/slices/sessionSlice";
import { buildPlan } from "../../../redux/thunks/buildPlan";
import { acceptLoopPlan, startLoopFromPlan } from "../../../redux/thunks/loop";
import { recordPlanAnswer } from "../../../util/planDecisions";

interface PlanCardProps {
  toolCallState: ToolCallState;
  historyIndex: number;
}

/**
 * The plan a present_plan call proposed: the plan text, its to-dos, a link
 * to the file (where the person can edit it), and Build / Keep planning while
 * nothing has been sent since.
 */
export function PlanCard({ toolCallState, historyIndex }: PlanCardProps) {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const { mainEditor } = useMainEditor();
  const isStreaming = useAppSelector((s) => s.session.isStreaming);
  // The decisions' answers as the plan file has them after the last one
  // recorded here, by question; the file stays the source of truth.
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // A typed answer for a decision without options, by its index.
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  // Once the person sends anything after the plan, the choice has been made.
  const answered = useAppSelector((s) =>
    s.session.history
      .slice(historyIndex + 1)
      .some((item) => item.message.role === "user"),
  );

  // Loop mode: this card is the loop's re-plan, waiting to be accepted
  const loopStatus = useAppSelector((s) => s.session.loop?.status);
  const isLatestPlanCard = useAppSelector((s) => {
    const later = s.session.history
      .slice(historyIndex + 1)
      .some((item) =>
        item.toolCallStates?.some(
          (tc) => tc.toolCall.function.name === "present_plan",
        ),
      );
    return !later;
  });
  const args = validatePlanArgs(toolCallState.parsedArgs ?? {});
  const output = toolCallState.output?.[0];
  const fileUri = output?.uri?.type === "file" ? output.uri.value : undefined;
  const relativePath = output?.description;
  const status = toolCallState.status;

  if (status === "generating" || status === "generated") {
    return (
      <div className="px-4 py-1 text-xs text-description">
        Writing the plan…
      </div>
    );
  }
  if (status !== "done" || !fileUri) {
    // Errors and cancels are shown by ToolCallDiv like any other tool call.
    return (
      <div className="px-4 py-1 text-xs text-description">
        The plan was not saved.
      </div>
    );
  }

  const awaitingLoop = loopStatus === "awaiting_plan" && isLatestPlanCard;
  const loopActive = !!loopStatus && loopStatus !== "stopped";

  const showActions =
    (!answered && !isStreaming && !loopActive) || awaitingLoop;

  /** Writes the answer into the plan file's Decisions section and shows it. */
  const answerDecision = async (decision: PlanDecision, answer: string) => {
    if (!answer.trim()) return;
    try {
      const decisions = await recordPlanAnswer(
        ideMessenger.ide,
        fileUri,
        decision.question,
        answer,
      );
      const recorded: Record<string, string> = {};
      for (const d of decisions) {
        if (d.answer) recorded[d.question] = d.answer;
      }
      setAnswers(recorded);
    } catch (e) {
      console.warn("Could not record the decision in the plan file", e);
    }
  };

  return (
    <div
      data-testid="plan-card"
      className="mx-2 my-1 rounded border border-solid border-border px-3 py-2"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
        <ClipboardDocumentListIcon className="h-4 w-4 shrink-0 text-description" />
        <span className="min-w-0 flex-1 basis-32 font-medium break-words">
          {args.ok ? args.title : output?.name}
        </span>
        <button
          type="button"
          data-testid="plan-card-open"
          title="Open the plan file to edit it"
          onClick={() => void ideMessenger.ide.openFile(fileUri)}
          className="max-w-full min-w-0 cursor-pointer truncate border-none bg-transparent p-0 text-left text-xs text-link hover:underline"
        >
          {relativePath ?? "Open plan"}
        </button>
      </div>
      {args.ok && args.body && (
        <div className="mt-1 max-h-96 overflow-y-auto text-sm">
          <StyledMarkdownPreview
            source={args.body}
            itemIndex={historyIndex}
            useParentBackgroundColor
          />
        </div>
      )}
      {args.ok && args.decisions.length > 0 && (
        <div data-testid="plan-card-decisions" className="mt-1 text-xs">
          <div className="text-description">
            Decisions for you (answer here, in the plan file, or in your
            message):
          </div>
          <ol className="m-0 mt-0.5 pl-4 text-description">
            {args.decisions.map((decision, i) => {
              const answer = answers[decision.question];
              return (
                <li key={i} className="py-0.5 break-words">
                  {decision.question}
                  {decision.type && (
                    <span className="text-description-muted">
                      {" "}
                      ({decision.type})
                    </span>
                  )}
                  {decision.options && decision.options.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1">
                      {decision.options.map((option) => (
                        <Button
                          key={option}
                          size="sm"
                          variant={answer === option ? "primary" : "outline"}
                          data-testid="plan-card-decision-option"
                          disabled={!showActions}
                          title={
                            option === decision.pick
                              ? "The model's pick. Click to record it in the plan file"
                              : "Click to record this answer in the plan file"
                          }
                          className="my-0.5"
                          onClick={() => void answerDecision(decision, option)}
                        >
                          {option === decision.pick
                            ? `${option} (pick)`
                            : option}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <form
                      className="flex flex-wrap items-center gap-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void answerDecision(decision, drafts[i] ?? "");
                      }}
                    >
                      <input
                        type="text"
                        data-testid="plan-card-decision-answer"
                        placeholder="Your answer"
                        disabled={!showActions}
                        value={drafts[i] ?? ""}
                        onChange={(e) =>
                          setDrafts({ ...drafts, [i]: e.target.value })
                        }
                        className="min-w-0 flex-1 basis-40 rounded border border-solid border-border bg-transparent px-1 text-xs text-foreground placeholder:text-description-muted"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        data-testid="plan-card-decision-submit"
                        disabled={!showActions || !drafts[i]?.trim()}
                        className="my-0.5"
                      >
                        Answer
                      </Button>
                    </form>
                  )}
                  {answer && (
                    <div
                      data-testid="plan-card-decision-answered"
                      className="text-description-muted"
                    >
                      Answer: {answer}
                    </div>
                  )}
                  {decision.todos && decision.todos.length > 0 && (
                    <div className="text-description-muted">
                      To-dos {decision.todos.join(", ")} wait on this.
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
      {args.ok && (
        <ul
          data-testid="plan-card-todos"
          className="m-0 mt-1 list-none p-0 text-xs text-description"
        >
          {args.items.map((item, i) => (
            <li key={i} className="py-0.5 break-words">
              <span className="font-mono text-description-muted">[ ]</span>{" "}
              {String(item.text)}
            </li>
          ))}
        </ul>
      )}
      {loopActive && !awaitingLoop && isLatestPlanCard && (
        <div
          data-testid="plan-card-loop-started"
          className="mt-2 text-2xs text-description-muted"
        >
          The loop is building this plan, one to-do at a time. Questions go to
          its inbox.
        </div>
      )}
      {showActions && awaitingLoop && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            data-testid="plan-card-loop-continue"
            title="Accept this plan and start the loop's next round"
            onClick={() => void dispatch(acceptLoopPlan())}
          >
            Continue the loop
          </Button>
          <span className="text-2xs text-description-muted">
            The loop's re-plan. Edit the file first if you like; the loop reads
            it again.
          </span>
        </div>
      )}
      {showActions && !awaitingLoop && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            data-testid="plan-card-build"
            title="Switch to Agent mode and implement the plan, reading the file again first"
            onClick={() => void dispatch(buildPlan({ planFile: fileUri }))}
          >
            Build
          </Button>
          <Button
            variant="outline"
            data-testid="plan-card-build-loop"
            title="Build the to-dos one at a time without driving each step: questions go to an inbox you can answer while it works"
            onClick={() =>
              void dispatch(startLoopFromPlan({ planFile: fileUri }))
            }
          >
            Build in a loop
          </Button>
          <Button
            variant="outline"
            data-testid="plan-card-keep-planning"
            title="Stay in Plan mode and say what to change"
            onClick={() => {
              dispatch(setMode("plan"));
              mainEditor?.commands.focus();
            }}
          >
            Keep planning
          </Button>
          <span className="text-2xs text-description-muted">
            Edit the file first if you like; Build reads it again.
          </span>
        </div>
      )}
    </div>
  );
}
