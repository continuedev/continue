import { CheckIcon, PlayIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ApplyState } from "core";
import { getMetaKeyLabel } from "../../../util";
import Spinner from "../../gui/Spinner";
import { ToolTip } from "../../gui/Tooltip";
import HoverItem from "../../mainInput/InputToolbar/HoverItem";
import { ToolbarButtonWithTooltip } from "./ToolbarButtonWithTooltip";

interface ApplyActionsProps {
  disableManualApply?: boolean;
  applyState?: ApplyState;
  onClickAccept: () => void;
  onClickReject: () => void;
  onClickApply?: () => void;
}

export function ApplyActions(props: ApplyActionsProps) {
  function onClickReject() {
    props.onClickReject();
  }

  switch (props.applyState ? props.applyState.status : null) {
    case "streaming":
      return (
        <div className="bg-badge flex select-none items-center rounded pl-2 pr-1">
          <span className="text-lightgray inline-flex items-center gap-2 text-center text-xs">
            Applying
            <Spinner />
          </span>
        </div>
      );
    case "done":
      return (
        <div className="bg-badge flex select-none items-center rounded sm:gap-1 md:px-1.5">
          <span className="text-lightgray flex items-center text-center text-xs max-md:hidden">
            {`${props.applyState?.numDiffs === 1 ? "1 diff" : `${props.applyState?.numDiffs} diffs`}`}
          </span>

          <div className="flex items-center">
            <ToolbarButtonWithTooltip
              data-testid="codeblock-toolbar-reject"
              onClick={onClickReject}
              tooltipContent={`Reject all (${getMetaKeyLabel()}⇧⌫)`}
            >
              <XMarkIcon className="text-error h-3.5 w-3.5 flex-shrink-0 hover:brightness-125" />
            </ToolbarButtonWithTooltip>

            <ToolbarButtonWithTooltip
              data-testid="codeblock-toolbar-accept"
              onClick={props.onClickAccept}
              tooltipContent={`Accept all (${getMetaKeyLabel()}⇧⏎)`}
            >
              <CheckIcon className="text-success h-3.5 w-3.5 flex-shrink-0 hover:brightness-125" />
            </ToolbarButtonWithTooltip>
          </div>
        </div>
      );
    case "closed":
    default:
      if (props.disableManualApply) {
        return null;
      }

      return (
        <ToolTip place="top" content="Apply Code">
          <HoverItem
            data-tooltip-id="codeblock-apply-code-button-tooltip"
            className="!p-0"
          >
            <button
              data-testid="codeblock-toolbar-apply"
              className="text-lightgray flex cursor-pointer items-center border-none bg-transparent pl-0 text-xs outline-none hover:brightness-125"
              onClick={props.onClickApply}
            >
              <div className="text-lightgray flex items-center gap-1">
                <PlayIcon className="h-3.5 w-3.5" />
                <span className="xs:inline hidden">Apply</span>
              </div>
            </button>
          </HoverItem>
        </ToolTip>
      );
  }
}
