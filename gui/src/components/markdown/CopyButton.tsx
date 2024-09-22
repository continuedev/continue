import { CheckIcon, ClipboardIcon } from "@heroicons/react/24/outline";
import { useContext, useState } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { isJetBrains } from "../../util";
import ButtonWithTooltip from "../ButtonWithTooltip";

interface CopyButtonProps {
  text: string | (() => string);
  color?: string;
  tabIndex?: number;
}

export function CopyButton(props: CopyButtonProps) {
  const [copied, setCopied] = useState<boolean>(false);

  const ideMessenger = useContext(IdeMessengerContext);

  return (
    <>
      <ButtonWithTooltip
        tabIndex={props.tabIndex}
        text={copied ? "Copied!" : "Copy"}
        onClick={(e) => {
          const text =
            typeof props.text === "string" ? props.text : props.text();
          if (isJetBrains()) {
            ideMessenger.request("copyText", { text });
          } else {
            navigator.clipboard.writeText(text);
          }

          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? (
          <CheckIcon className="w-4 h-4 text-green-500" />
        ) : (
          <ClipboardIcon className="w-4 h-4" color={props.color} />
        )}
      </ButtonWithTooltip>
    </>
  );
}
