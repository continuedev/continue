import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ApplyState } from "core";
import { useContext } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { getMetaKeyLabel } from "../util";
import { useFontSize } from "./ui/font";

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

  const tinyFont = useFontSize(-3);
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

  if (!pendingApplyStates.length) {
    return null;
  }

  return (
    <div
      className="flex flex-row items-center justify-evenly gap-2 p-1 px-3"
      data-testid="accept-reject-all-buttons"
    >
      <button
        className="flex cursor-pointer flex-row flex-wrap justify-center gap-1 border-none bg-transparent px-2 py-1 text-xs text-gray-300 opacity-80 hover:opacity-100 hover:brightness-125"
        onClick={() => handleAcceptOrReject("rejectDiff")}
        data-testid="edit-reject-button"
      >
        <div className="flex flex-row items-center gap-1">
          <XMarkIcon className="h-4 w-4 text-red-600" />
          <span>Reject</span>
          <span className="xs:inline-block hidden">All</span>
        </div>

        <span
          className="xs:inline-block hidden text-gray-400"
          style={{
            fontSize: tinyFont,
          }}
        >
          ({getMetaKeyLabel()}⇧⌫)
        </span>
      </button>
      <button
        className="flex cursor-pointer flex-row flex-wrap justify-center gap-1 border-none bg-transparent px-2 py-1 text-xs text-gray-300 opacity-80 hover:opacity-100 hover:brightness-125"
        onClick={() => handleAcceptOrReject("acceptDiff")}
        data-testid="edit-accept-button"
      >
        <div className="flex flex-row items-center gap-1">
          <CheckIcon className="h-4 w-4 text-green-600" />
          <span>Accept</span>
          <span className="xs:inline-block hidden">All</span>
        </div>
        <span
          className="xs:inline-block hidden text-gray-400"
          style={{
            fontSize: tinyFont,
          }}
        >
          ({getMetaKeyLabel()}⇧⏎)
        </span>
      </button>
    </div>
  );
}
