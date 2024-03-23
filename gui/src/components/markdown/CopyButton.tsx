import { CheckIcon, ClipboardIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { vscEditorBackground } from "..";
import HeaderButtonWithText from "../HeaderButtonWithText";

interface CopyButtonProps {
  text: string | (() => string);
}

export function CopyButton(props: CopyButtonProps) {
  const [copied, setCopied] = useState<boolean>(false);

  return (
    <>
      <HeaderButtonWithText
        text={copied ? "Copied!" : "Copy"}
        style={{ backgroundColor: vscEditorBackground }}
        onClick={(e) => {
          navigator.clipboard.writeText(
            typeof props.text === "string" ? props.text : props.text(),
          );
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? (
          <CheckIcon className="w-4 h-4 text-green-500" />
        ) : (
          <ClipboardIcon className="w-4 h-4" />
        )}
      </HeaderButtonWithText>
    </>
  );
}
