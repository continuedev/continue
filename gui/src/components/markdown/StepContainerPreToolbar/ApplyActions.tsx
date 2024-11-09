import { CheckIcon, XMarkIcon, PlayIcon } from "@heroicons/react/24/outline";
import Spinner from "./Spinner";
import { lightGray, vscForeground } from "../..";
import { ApplyState } from "core/protocol/ideWebview";
import { useState } from "react";

interface ApplyActionsProps {
  applyState?: ApplyState;
  onClickAccept: () => void;
  onClickReject: () => void;
  onClickApply: () => void;
}

export default function ApplyActions(props: ApplyActionsProps) {
  const [hasRejected, setHasRejected] = useState(false);

  function onClickReject() {
    props.onClickReject();
    setHasRejected(true);
  }

  // console.log(props.applyState.numDiffs);

  switch (props.applyState ? props.applyState.status : null) {
    case "streaming":
      return (
        <span className="inline-flex items-center gap-2 text-gray-400">
          Applying changes
          <Spinner />
        </span>
      );
    case "done":
      return (
        <div className="flex items-center rounded bg-zinc-700 pl-2 pr-1">
          <span className="mr-2 text-xs text-gray-400">
            {`${props.applyState.numDiffs === 1 ? "1 diff" : `${props.applyState.numDiffs} diffs`} remaining`}
          </span>

          <button
            className={`text-[${vscForeground}] flex cursor-pointer items-center border-none bg-transparent px-0.5 text-xs text-gray-400 outline-none hover:brightness-125`}
            onClick={onClickReject}
          >
            <XMarkIcon className="h-4 w-4 text-red-700 hover:brightness-125" />
          </button>

          <button
            className={`text-[${vscForeground}] flex cursor-pointer items-center border-none bg-transparent px-0.5 text-xs text-gray-400 outline-none hover:brightness-125`}
            onClick={props.onClickAccept}
          >
            <CheckIcon className="h-4 w-4 text-green-700 hover:brightness-125" />
          </button>
        </div>
      );
    case "closed":
      // We show a codeblock as being "applied" whenever all individual diffs
      // have been accepted/rejected, or when a user has explicitly accepted the entire block.
      if (!hasRejected && props.applyState.numDiffs === 0) {
        return (
          <span className="flex items-center rounded bg-zinc-700 pl-2 pr-1 text-slate-400">
            Applied
            <CheckIcon className="h-4 w-4 pl-1 hover:brightness-125" />
          </span>
        );
      }
    default:
      return (
        <button
          className={`flex items-center border-none bg-transparent text-xs text-[${vscForeground}] cursor-pointer outline-none hover:brightness-125`}
          onClick={props.onClickApply}
          style={{ color: lightGray }}
        >
          <div className="flex items-center gap-1">
            <PlayIcon className="h-3 w-3" />
            <span className="xs:inline hidden">Apply</span>
          </div>
        </button>
      );
  }
}
