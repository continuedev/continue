import { CheckIcon, ClipboardIcon } from "@heroicons/react/24/outline";
import useCopy from "../../../hooks/useCopy";

interface CopyButtonProps {
  text: string;
}

export default function CopyButton({ text }: CopyButtonProps) {
  const { copyText, copied } = useCopy(text);

  return (
    <div
      className={`text-vsc-foreground flex cursor-pointer items-center border-none bg-transparent text-xs text-gray-400 outline-none hover:brightness-125`}
      onClick={copyText}
    >
      <div className="text-description max-2xs:hidden flex items-center gap-1 transition-colors duration-200 hover:brightness-125">
        {copied ? (
          <>
            <CheckIcon className="h-3 w-3 text-green-500 hover:brightness-125" />
            <span className="max-sm:hidden">Copied</span>
          </>
        ) : (
          <>
            <ClipboardIcon className="h-3 w-3 hover:brightness-125" />
            <span className="text-description max-sm:hidden">Copy</span>
          </>
        )}
      </div>
    </div>
  );
}
