import { DocumentPlusIcon } from "@heroicons/react/24/outline";
import { vscForeground } from "../..";

interface CreateFileButtonProps {
  onClick: () => void;
}

export function CreateFileButton({ onClick }: CreateFileButtonProps) {
  return (
    <>
      <button
        data-testid="codeblock-toolbar-create"
        className={`text-lightgray flex items-center border-none bg-transparent pl-0 text-xs text-[${vscForeground}] cursor-pointer outline-none hover:brightness-125`}
        onClick={onClick}
      >
        <div className="flex items-center gap-1">
          <DocumentPlusIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-1 break-all">Create file</span>
        </div>
      </button>
    </>
  );
}
