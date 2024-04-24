import { CheckIcon, ClipboardIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { ideRequest, isJetBrains } from "../../util/ide";
import HeaderButtonWithText from "../HeaderButtonWithText";

interface CopyButtonProps {
  text: string | (() => string);
  color?: string;
}

export function CopyButton(props: CopyButtonProps) {
  const [copied, setCopied] = useState<boolean>(false);

  return (
    <>
      <HeaderButtonWithText
        text={copied ? "Copied!" : "Copy"}
        onClick={(e) => {
          const text =
            typeof props.text === "string" ? props.text : props.text();
          if (isJetBrains()) {
            ideRequest("copyText", { text });
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
      </HeaderButtonWithText>
    </>
  );
}
