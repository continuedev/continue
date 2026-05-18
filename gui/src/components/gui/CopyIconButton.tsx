import { CheckIcon, ClipboardIcon } from "@heroicons/react/24/outline";
import HeaderButtonWithToolTip from "./HeaderButtonWithToolTip";
import useCopy from "../../hooks/useCopy";
import { useTranslation } from "react-i18next";

interface CopyIconButtonProps {
  text: string | (() => string);
  tabIndex?: number;
  checkIconClassName?: string;
  clipboardIconClassName?: string;
  tooltipPlacement?: "top" | "bottom";
}

export function CopyIconButton({
  text,
  tabIndex,
  checkIconClassName = "h-4 w-4 text-green-400",
  clipboardIconClassName = "h-4 w-4 text-gray-400",
  tooltipPlacement = "bottom",
}: CopyIconButtonProps) {
  const { t } = useTranslation();
  const { copyText, copied } = useCopy(text);

  return (
    <>
      <HeaderButtonWithToolTip
        tooltipPlacement={tooltipPlacement}
        tabIndex={tabIndex}
        text={copied ? t("CopyIconButton.Copied") : t("CopyIconButton.Copy")}
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
