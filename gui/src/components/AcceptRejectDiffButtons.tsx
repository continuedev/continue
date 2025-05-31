import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ApplyState } from "core";
import { useContext } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { getMetaKeyLabel } from "../util";
import { ToolTip } from "./gui/Tooltip";

export interface AcceptRejectAllButtonsProps {
  applyStates: ApplyState[];
  onAcceptOrReject?: (outcome: AcceptOrRejectOutcome) => void;
}

export type AcceptOrRejectOutcome = "acceptDiff" | "rejectDiff";

export default function AcceptRejectAllButtons({
  applyStates,
  onAcceptOrReject,
}: AcceptRejectAllButtonsProps) {
  const pendingApplyStates = applyStates.filter(
    (state) => state.status === "done",
  );
  const ideMessenger = useContext(IdeMessengerContext);

  async function handleAcceptOrReject(status: AcceptOrRejectOutcome) {
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

  return (
    <div
      className="flex flex-row items-center justify-evenly gap-3 px-3"
      data-testid="accept-reject-all-buttons"
    >
      <button
        className="text-foreground flex cursor-pointer flex-row flex-wrap justify-center gap-1 border-none bg-transparent p-0 text-xs opacity-80 hover:opacity-100 hover:brightness-125"
        onClick={() => handleAcceptOrReject("rejectDiff")}
        data-testid="edit-reject-button"
        data-tooltip-id="reject-shortcut"
        data-tooltip-content={`Reject All (${rejectShortcut})`}
      >
        <div className="flex flex-row items-center gap-1">
          <XMarkIcon className="text-error h-4 w-4" />
          <span>Reject</span>
          <span className="xs:inline-block hidden">All</span>
        </div>
      </button>
      <ToolTip id="reject-shortcut" />

      <button
        className="text-foreground flex cursor-pointer flex-row flex-wrap justify-center gap-1 border-none bg-transparent p-0 text-xs opacity-80 hover:opacity-100 hover:brightness-125"
        onClick={() => handleAcceptOrReject("acceptDiff")}
        data-testid="edit-accept-button"
        data-tooltip-id="accept-shortcut"
        data-tooltip-content={`Accept All (${acceptShortcut})`}
      >
        <div className="flex flex-row items-center gap-1">
          <CheckIcon className="text-success h-4 w-4" />
          <span>Accept</span>
          <span className="xs:inline-block hidden">All</span>
        </div>
      </button>
      <ToolTip id="accept-shortcut" />
    </div>
  );
}
