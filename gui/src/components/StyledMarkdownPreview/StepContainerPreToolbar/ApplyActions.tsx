import { CheckIcon, PlayIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ApplyState } from "core";
import { useEffect, useState } from "react";
import { getMetaKeyLabel } from "../../../util";
import Spinner from "../../gui/Spinner";
import { ToolbarButtonWithTooltip } from "./ToolbarButtonWithTooltip";

interface ApplyActionsProps {
  disableManualApply?: boolean;
  applyState?: ApplyState;
  onClickAccept: () => void;
  onClickReject: () => void;
  onClickApply: () => void;
}

export function ApplyActions(props: ApplyActionsProps) {
  const [hasRejected, setHasRejected] = useState(false);
  const [showApplied, setShowApplied] = useState(false);
  const isClosed = props.applyState?.status === "closed";
  const isSuccessful = !hasRejected && props.applyState?.numDiffs === 0;

  useEffect(() => {
    if (isClosed && isSuccessful) {
      setShowApplied(true);
      const timer = setTimeout(() => {
        setShowApplied(false);
      }, 3_000);
      return () => clearTimeout(timer);
    }
  }, [isClosed, isSuccessful]);

  function onClickReject() {
    props.onClickReject();
    setHasRejected(true);
  }

  const applyButton = (text: string) => (
    <button
      data-testid="codeblock-toolbar-apply"
      className="text-lightgray text-[${vscForeground}] flex cursor-pointer items-center border-none bg-transparent pl-0 text-xs outline-none hover:brightness-125"
      onClick={props.onClickApply}
    >
      <div className="text-lightgray flex items-center gap-1">
        <PlayIcon className="h-3.5 w-3.5" />
        <span className="xs:inline hidden">{text}</span>
      </div>
    </button>
  );

  switch (props.applyState ? props.applyState.status : null) {
    case "streaming":
      return (
        <div className="flex items-center rounded bg-zinc-700 pl-2 pr-1">
          <span className="text-lightgray inline-flex w-min items-center gap-2 text-center text-xs">
            Applying
            <Spinner />
          </span>
        </div>
      );
    case "done":
      return (
        <div className="flex items-center rounded bg-zinc-700 px-1.5 sm:gap-1">
          <span className="max-xs:hidden text-lightgray text-center text-xs">
            {`${props.applyState?.numDiffs === 1 ? "1 diff" : `${props.applyState?.numDiffs} diffs`}`}
          </span>

          <div className="flex">
            <ToolbarButtonWithTooltip
              data-testid="codeblock-toolbar-reject"
              onClick={onClickReject}
              tooltipContent={`Reject all (${getMetaKeyLabel()}⇧⌫)`}
            >
              <XMarkIcon className="h-3.5 w-3.5 text-red-600 hover:brightness-125" />
            </ToolbarButtonWithTooltip>

            <ToolbarButtonWithTooltip
              data-testid="codeblock-toolbar-accept"
              onClick={props.onClickAccept}
              tooltipContent={`Accept all (${getMetaKeyLabel()}⇧⏎)`}
            >
              <CheckIcon className="h-3.5 w-3.5 text-green-600 hover:brightness-125" />
            </ToolbarButtonWithTooltip>
          </div>
        </div>
      );
    case "closed":
      if (!hasRejected && props.applyState?.numDiffs === 0) {
        if (showApplied) {
          return (
            <span className="flex items-center rounded bg-zinc-700 text-slate-400 max-sm:px-0.5 sm:pl-2">
              <span className="max-sm:hidden">Applied</span>
              <CheckIcon className="h-3.5 w-3.5 hover:brightness-125 sm:px-1" />
            </span>
          );
        }
        if (props.disableManualApply) {
          return null;
        }
        return applyButton("Reapply");
      }
    default:
      if (props.disableManualApply) {
        return null;
      }
      return applyButton("Apply");
  }
}
