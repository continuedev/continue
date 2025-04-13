import { DocumentPlusIcon } from "@heroicons/react/24/outline";
import { getLastNPathParts } from "core/util/uri";
import { vscForeground } from "../..";
import { ToolTip } from "../../gui/Tooltip";

interface CreateFileButtonProps {
  filepath: string;
  onClick: () => void;
}

export default function CreateFileButton({
  filepath,
  onClick,
}: CreateFileButtonProps) {
  return (
    <>
      <button
        className={`text-lightgray flex items-center border-none bg-transparent pl-0 text-xs text-[${vscForeground}] cursor-pointer outline-none hover:brightness-125`}
        onClick={onClick}
        data-tooltip-id="create-file-tooltip"
        data-tooltip-content={filepath}
        data-tooltip-place="top-start"
      >
        <div className="flex items-center gap-1">
          <DocumentPlusIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-1 break-all">
            Create {getLastNPathParts(filepath, 1)}
          </span>
        </div>
      </button>
      <ToolTip
        id="create-file-tooltip"
        style={{
          maxWidth: "200px",
          textAlign: "left",
          whiteSpace: "normal",
          wordBreak: "break-word",
        }}
      />
    </>
  );
}
