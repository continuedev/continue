import { useContext } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ApplyState } from "core/protocol/ideWebview";

export interface AcceptRejectAllButtonsProps {
  pendingApplyStates: ApplyState[];
}

export default function AcceptRejectAllButtons({
  pendingApplyStates,
}: AcceptRejectAllButtonsProps) {
  const ideMessenger = useContext(IdeMessengerContext);

  async function handleAcceptOrReject(status: "acceptDiff" | "rejectDiff") {
    for (const { filepath, streamId } of pendingApplyStates) {
      ideMessenger.post(status, {
        filepath,
        streamId,
      });
    }
  }

  return (
    <div className="flex justify-center gap-2 border-b border-gray-200/25 p-1 px-3">
      <button
        className="flex cursor-pointer items-center border-none bg-transparent px-2 py-1 text-xs text-gray-300 opacity-80 hover:opacity-100 hover:brightness-125"
        onClick={() => handleAcceptOrReject("rejectDiff")}
      >
        <XMarkIcon className="mr-1 h-4 w-4 text-red-600" />
        <span className="sm:hidden">Reject</span>
        <span className="max-sm:hidden md:hidden">Reject all</span>
        <span className="max-md:hidden">Reject all changes</span>
      </button>
      <button
        className="flex cursor-pointer items-center border-none bg-transparent px-2 py-1 text-xs text-gray-300 opacity-80 hover:opacity-100 hover:brightness-125"
        onClick={() => handleAcceptOrReject("acceptDiff")}
      >
        <CheckIcon className="mr-1 h-4 w-4 text-green-600" />
        <span className="sm:hidden">Accept</span>
        <span className="max-sm:hidden md:hidden">Accept all</span>
        <span className="max-md:hidden">Accept all changes</span>
      </button>
    </div>
  );
}
