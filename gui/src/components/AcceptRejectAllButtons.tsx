import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ApplyState } from "core";
import { useContext } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { useAppSelector } from "../redux/hooks";
import { selectIsSingleRangeEditOrInsertion } from "../redux/slices/sessionSlice";
import { getMetaKeyLabel } from "../util";

export interface AcceptRejectAllButtonsProps {
  pendingApplyStates: ApplyState[];
  onAcceptOrReject?: (outcome: AcceptOrRejectOutcome) => void;
}

export type AcceptOrRejectOutcome = "acceptDiff" | "rejectDiff";

export default function AcceptRejectAllButtons({
  pendingApplyStates,
  onAcceptOrReject,
}: AcceptRejectAllButtonsProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const isSingleRangeEdit = useAppSelector(selectIsSingleRangeEditOrInsertion);

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

  return (
    <div className="flex justify-center gap-2 border-b border-gray-200/25 p-1 px-3">
      <button
        className="flex cursor-pointer items-center border-none bg-transparent px-2 py-1 text-xs text-gray-300 opacity-80 hover:opacity-100 hover:brightness-125"
        onClick={() => handleAcceptOrReject("rejectDiff")}
        data-testid="edit-reject-button"
      >
        <XMarkIcon className="mr-1 h-4 w-4 text-red-600" />
        {isSingleRangeEdit ? (
          <span>Reject ({getMetaKeyLabel()}⇧⌫)</span>
        ) : (
          <>
            <span className="sm:hidden">Reject</span>
            <span className="max-sm:hidden md:hidden">Reject all</span>
            <span className="max-md:hidden">Reject all changes</span>
          </>
        )}
      </button>
      <button
        className="flex cursor-pointer items-center border-none bg-transparent px-2 py-1 text-xs text-gray-300 opacity-80 hover:opacity-100 hover:brightness-125"
        onClick={() => handleAcceptOrReject("acceptDiff")}
        data-testid="edit-accept-button"
      >
        <CheckIcon className="mr-1 h-4 w-4 text-green-600" />
        {isSingleRangeEdit ? (
          <span>Accept ({getMetaKeyLabel()}⇧⏎)</span>
        ) : (
          <>
            <span className="sm:hidden">Accept</span>
            <span className="max-sm:hidden md:hidden">Accept all</span>
            <span className="max-md:hidden">Accept all changes</span>
          </>
        )}
      </button>
    </div>
  );
}
