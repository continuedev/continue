import { CheckIcon, PlayIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ApplyState } from "core";
import { useEffect, useState } from "react";
import { vscBorder } from "../..";
import { getMetaKeyLabel } from "../../../util";
import Spinner from "../../gui/Spinner";
import { ToolbarButtonWithTooltip } from "./ToolbarButtonWithTooltip";

interface ApplyActionsProps {
  applyState?: ApplyState;
  onClickAccept: () => void;
  onClickReject: () => void;
  onClickApply: () => void;
}

export default function ApplyActions(props: ApplyActionsProps) {
  const [hasRejected, setHasRejected] = useState(false);
  const [showApplied, setShowApplied] = useState(false);
  const isClosed = props.applyState?.status === "closed";
  const isSuccessful = !hasRejected && props.applyState?.numDiffs === 0;

  useEffect(() => {
    if (isClosed && isSuccessful) {
      setShowApplied(true);
      const timer = setTimeout(() => {
        setShowApplied(false);
      }, 2_000);
      return () => clearTimeout(timer);
    }
  }, [isClosed, isSuccessful]);

  function onClickReject() {
    props.onClickReject();
    setHasRejected(true);
  }

  const applyButton = (text: string) => (
    <button
      className={`text-vsc-foreground flex cursor-pointer items-center border-none bg-transparent text-xs outline-none hover:brightness-125`}
      onClick={props.onClickApply}
      style={{ color: vscBorder }}
    >
      <div className="text-description flex items-center gap-1">
        <PlayIcon className="h-3 w-3" />
        <span className="xs:inline hidden">{text}</span>
      </div>
    </button>
  );

  switch (props.applyState ? props.applyState.status : null) {
    case "streaming":
      return (
        <div className="flex items-center rounded bg-zinc-700 pl-2 pr-1">
          <span className="text-description inline-flex items-center gap-2 text-xs">
            Applying changes
            <Spinner />
          </span>
        </div>
      );
    case "done":
      return (
        <div className="xs:pl-2 xs:pr-1 flex items-center rounded bg-zinc-700">
          <span className="max-xs:hidden xs:mr-1 text-description text-xs">
            {`${props.applyState?.numDiffs === 1 ? "1 diff" : `${props.applyState?.numDiffs} diffs`}`}
            <span className="max-md:hidden">{` remaining`}</span>
          </span>

          <ToolbarButtonWithTooltip
            onClick={onClickReject}
            tooltipContent={`Reject all (${getMetaKeyLabel()}⇧⌫)`}
          >
            <XMarkIcon className="text-error h-4 w-4 hover:brightness-125" />
          </ToolbarButtonWithTooltip>

          <ToolbarButtonWithTooltip
            onClick={props.onClickAccept}
            tooltipContent={`Accept all (${getMetaKeyLabel()}⇧⏎)`}
          >
            <CheckIcon className="text-success h-4 w-4 hover:brightness-125" />
          </ToolbarButtonWithTooltip>
        </div>
      );
    case "closed":
      if (!hasRejected && props.applyState?.numDiffs === 0) {
        if (showApplied) {
          return (
            <span className="text-description flex items-center rounded bg-zinc-700 max-sm:px-0.5 sm:pl-2">
              <span className="max-sm:hidden">Applied</span>
              <CheckIcon className="h-4 w-4 hover:brightness-125 sm:px-1" />
            </span>
          );
        }

        return applyButton("Re-apply");
      }
    default:
      return applyButton("Apply");
  }
}
