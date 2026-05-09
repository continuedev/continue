import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ApplyState } from "core";
import { useContext, useEffect, useRef, useState } from "react";
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
  const [pendingOutcome, setPendingOutcome] =
    useState<AcceptOrRejectOutcome | null>(null);
  const resetPendingOutcomeTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  useEffect(() => {
    return () => {
      if (resetPendingOutcomeTimeoutRef.current) {
        clearTimeout(resetPendingOutcomeTimeoutRef.current);
      }
    };
  }, []);

  async function handleAcceptOrReject(status: AcceptOrRejectOutcome) {
    if (pendingOutcome || pendingApplyStates.length === 0) {
      return;
    }

    setPendingOutcome(status);

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
      await onAcceptOrReject(status);
    }

    if (resetPendingOutcomeTimeoutRef.current) {
      clearTimeout(resetPendingOutcomeTimeoutRef.current);
    }

    resetPendingOutcomeTimeoutRef.current = setTimeout(() => {
      setPendingOutcome(null);
      resetPendingOutcomeTimeoutRef.current = null;
    }, 1500);
  }

  const rejectShortcut = `${getMetaKeyLabel()}⇧⌫`;
  const acceptShortcut = `${getMetaKeyLabel()}⇧⏎`;
  const isBatchAction = pendingApplyStates.length > 1;
  const isUndoPending = pendingOutcome === "rejectDiff";
  const isKeepPending = pendingOutcome === "acceptDiff";
  const isPending = pendingOutcome !== null;
  const undoLabel = isBatchAction
    ? isUndoPending
      ? "Undoing all..."
      : "Undo all"
    : isUndoPending
      ? "Undoing..."
      : "Undo";
  const keepLabel = isBatchAction
    ? isKeepPending
      ? "Keeping all..."
      : "Keep all"
    : isKeepPending
      ? "Keeping..."
      : "Keep";

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
          className={cn(
            "text-foreground flex flex-row flex-wrap justify-center gap-1 border-none bg-transparent p-0 text-xs opacity-80",
            isPending
              ? "cursor-not-allowed"
              : "cursor-pointer hover:opacity-100 hover:brightness-125",
          )}
          onClick={() => handleAcceptOrReject("rejectDiff")}
          data-testid="edit-reject-button"
          disabled={isPending}
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
          className={cn(
            "text-foreground flex flex-row flex-wrap justify-center gap-1 border-none bg-transparent p-0 text-xs opacity-80",
            isPending
              ? "cursor-not-allowed"
              : "cursor-pointer hover:opacity-100 hover:brightness-125",
          )}
          onClick={() => handleAcceptOrReject("acceptDiff")}
          data-testid="edit-accept-button"
          disabled={isPending}
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
