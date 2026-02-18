import { CheckIcon, ClipboardIcon } from "@heroicons/react/24/outline";
import useCopy from "../../../hooks/useCopy";
import { ToolTip } from "../../gui/Tooltip";
import HoverItem from "../../mainInput/InputToolbar/HoverItem";

interface CopyButtonProps {
  text: string;
}

export function CopyButton({ text }: CopyButtonProps) {
  const { copyText, copied } = useCopy(text);

  return (
    <ToolTip place="top" content="Copy Code">
      <HoverItem className="!p-0">
        <div
          className="text-lightgray flex cursor-pointer items-center border-none bg-transparent text-xs outline-none hover:brightness-125"
          onClick={copyText}
        >
          <div className="flex items-center gap-1 transition-colors duration-200 hover:brightness-125">
            {copied ? (
              <CheckIcon className="h-3.5 w-3.5 text-green-500 hover:brightness-125" />
            ) : (
              <ClipboardIcon className="h-3.5 w-3.5 hover:brightness-125" />
            )}
          </div>
        </div>
      </HoverItem>
    </ToolTip>
  );
}
