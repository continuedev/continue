import { CheckIcon, ClipboardIcon } from "@heroicons/react/24/outline";
import { useContext, useState } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { isJetBrains } from "../../util";
import HeaderButtonWithToolTip from "./HeaderButtonWithToolTip";
import useCopy from "../../hooks/useCopy";

interface CopyIconButtonProps {
  text: string | (() => string);
  tabIndex?: number;
  checkIconClassName?: string;
  clipboardIconClassName?: string;
}

export function CopyIconButton({
  text,
  tabIndex,
  checkIconClassName = "h-4 w-4 text-green-400",
  clipboardIconClassName = "h-4 w-4 text-gray-400",
}: CopyIconButtonProps) {
  const { copyText, copied } = useCopy(text);

  return (
    <>
      <HeaderButtonWithToolTip
        tooltipPlacement="top"
        tabIndex={tabIndex}
        text={copied ? "Copied" : "Copy"}
        onClick={copyText}
      >
        {copied ? (
          <CheckIcon className={checkIconClassName} />
        ) : (
          <ClipboardIcon className={clipboardIconClassName} />
        )}
      </HeaderButtonWithToolTip>
    </>
  );
}
