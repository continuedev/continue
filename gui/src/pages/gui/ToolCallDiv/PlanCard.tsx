import { ClipboardDocumentListIcon } from "@heroicons/react/24/outline";
import { ToolCallState } from "core";
import { validatePlanArgs } from "core/util/planFile";
import { useContext } from "react";
import { useMainEditor } from "../../../components/mainInput/TipTapEditor";
import StyledMarkdownPreview from "../../../components/StyledMarkdownPreview";
import { Button } from "../../../components/ui";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { setMode } from "../../../redux/slices/sessionSlice";
import { buildPlan } from "../../../redux/thunks/buildPlan";
import { acceptLoopPlan, startLoopFromPlan } from "../../../redux/thunks/loop";

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
