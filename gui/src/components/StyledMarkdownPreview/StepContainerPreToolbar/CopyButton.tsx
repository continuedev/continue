import { CheckIcon, ClipboardIcon } from "@heroicons/react/24/outline";
import { lightGray } from "../..";
import useCopy from "../../../hooks/useCopy";

interface CopyButtonProps {
  text: string;
}

export default function CopyButton({ text }: CopyButtonProps) {
  const { copyText, copied } = useCopy(text);

  return (
    <div
      className={`flex cursor-pointer items-center border-none bg-transparent text-xs outline-none hover:brightness-125`}
      onClick={copyText}
    >
      <div
        className="flex items-center gap-1 transition-colors duration-200 hover:brightness-125"
        style={{ color: lightGray }}
      >
        {copied ? (
          <CheckIcon className="h-3.5 w-3.5 text-green-500 hover:brightness-125" />
        ) : (
          <ClipboardIcon className="h-3.5 w-3.5 hover:brightness-125" />
        )}
      </div>
    </div>
  );
}
