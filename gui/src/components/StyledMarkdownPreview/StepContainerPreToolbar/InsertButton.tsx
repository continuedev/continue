import { ArrowLeftEndOnRectangleIcon } from "@heroicons/react/24/outline";
import { ToolTip } from "../../gui/Tooltip";
import HoverItem from "../../mainInput/InputToolbar/HoverItem";

/**
 * Button that inserts code at the current cursor position
 */
interface InsertButtonProps {
  onInsert: () => void;
}

export function InsertButton({ onInsert }: InsertButtonProps) {
  return (
    <HoverItem
      data-tooltip-id="codeblock-insert-button-tooltip"
      className="!p-0"
    >
      <ToolTip place="top" content="Insert Code">
        <div
          className="flex cursor-pointer items-center border-none bg-transparent text-xs text-lightgray outline-none hover:brightness-125"
          onClick={onInsert}
        >
          <div className="flex items-center gap-1 transition-colors duration-200 max-2xs:hidden">
            <ArrowLeftEndOnRectangleIcon className="h-3.5 w-3.5" />
          </div>
        </div>
      </ToolTip>
    </HoverItem>
  );
}
