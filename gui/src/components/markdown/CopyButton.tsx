import { CheckIcon, ClipboardIcon } from "@heroicons/react/24/outline";
import { useContext, useState } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { isJetBrains } from "../../util";
import ButtonWithTooltip from "../ButtonWithTooltip";

interface CopyButtonProps {
  text: string | (() => string);
  tabIndex?: number;
  checkIconClassName?: string;
  clipboardIconClassName?: string;
}

export function CopyButton({
  text,
  tabIndex,
  checkIconClassName = "h-4 w-4 text-green-400",
  clipboardIconClassName = "h-4 w-4 text-gray-400",
}: CopyButtonProps) {
  const [copied, setCopied] = useState<boolean>(false);

  const ideMessenger = useContext(IdeMessengerContext);

  return (
    <>
      <ButtonWithTooltip
        tabIndex={tabIndex}
        text={copied ? "Copied!" : "Copy"}
        onClick={(e) => {
          const textVal = typeof text === "string" ? text : text();
          if (isJetBrains()) {
            ideMessenger.request("copyText", { text: textVal });
          } else {
            navigator.clipboard.writeText(textVal);
          }

          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? (
          <CheckIcon className={checkIconClassName} />
        ) : (
          <ClipboardIcon className={clipboardIconClassName} />
        )}
      </ButtonWithTooltip>
    </>
  );
}
