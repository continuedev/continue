import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ApplyState } from "core";
import { useContext } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { useAppDispatch } from "../redux/hooks";
import { cancelToolCall } from "../redux/slices/sessionSlice";
import { getMetaKeyLabel } from "../util";
import { cn } from "../util/cn";
import { ToolTip } from "./gui/Tooltip";

export interface AcceptRejectAllButtonsProps {
  applyStates: ApplyState[];
  onAcceptOrReject?: (outcome: AcceptOrRejectOutcome) => void;
  className?: string;
  testId?: string;
}

export type AcceptOrRejectOutcome = "acceptDiff" | "rejectDiff";

export default function AcceptRejectAllButtons({
  applyStates,
  onAcceptOrReject,
  className,
  testId = "accept-reject-all-buttons",
}: AcceptRejectAllButtonsProps) {
  const pendingApplyStates = applyStates.filter(
    (state) => state.status === "done",
  );
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useAppDispatch();
  async function handleAcceptOrReject(status: AcceptOrRejectOutcome) {
    // For reject operations, cancel all tool calls associated with pending apply states
    if (status === "rejectDiff") {
      for (const applyState of pendingApplyStates) {
        if (applyState.toolCallId && applyState.status === "done") {
          dispatch(
            cancelToolCall({
              toolCallId: applyState.toolCallId,
            }),
          );
        }
      }
    }

    // Process all pending apply states
    for (const { filepath = "", streamId } of pendingApplyStates) {
      ideMessenger.post(status, {
        filepath,
        streamId,
      });
    }

    if (onAcceptOrReject) {
      onAcceptOrReject(status);
    }
  }

  const rejectShortcut = `${getMetaKeyLabel()}⇧⌫`;
  const acceptShortcut = `${getMetaKeyLabel()}⇧⏎`;
  const isBatchAction = pendingApplyStates.length > 1;
  const undoLabel = isBatchAction ? "Undo all" : "Undo";
  const keepLabel = isBatchAction ? "Keep all" : "Keep";

  return (
    <div
      className={cn(
        "flex flex-row items-center justify-evenly gap-3 px-3",
        className,
      )}
      data-testid={testId}
    >
      <ToolTip content={`${undoLabel} (${rejectShortcut})`}>
        <button
          className="text-foreground flex cursor-pointer flex-row flex-wrap justify-center gap-1 border-none bg-transparent p-0 text-xs opacity-80 hover:opacity-100 hover:brightness-125"
          onClick={() => handleAcceptOrReject("rejectDiff")}
          data-testid="edit-reject-button"
        >
          <div className="flex flex-row items-center gap-1">
            <XMarkIcon className="text-error h-4 w-4" />
            <span className="hidden sm:inline">{undoLabel}</span>
            <span className="text-lightgray -ml-1.5 hidden scale-75 text-xs md:inline">
              {rejectShortcut}
            </span>
          </div>
        </button>
      </ToolTip>

      <ToolTip content={`${keepLabel} (${acceptShortcut})`}>
        <button
          className="text-foreground flex cursor-pointer flex-row flex-wrap justify-center gap-1 border-none bg-transparent p-0 text-xs opacity-80 hover:opacity-100 hover:brightness-125"
          onClick={() => handleAcceptOrReject("acceptDiff")}
          data-testid="edit-accept-button"
        >
          <div className="flex flex-row items-center gap-1">
            <CheckIcon className="text-success h-4 w-4" />
            <span className="hidden sm:inline">{keepLabel}</span>
            <span className="text-lightgray -ml-1.5 hidden scale-75 text-xs md:inline">
              {acceptShortcut}
            </span>
          </div>
        </button>
      </ToolTip>
    </div>
  );
}
