import { CheckIcon, QueueListIcon } from "@heroicons/react/24/outline";
import { useContext, useMemo, useState } from "react";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { isJetBrains } from "../../../util";
import ButtonWithTooltip from "../../ButtonWithTooltip";
import { ChatHistoryItem } from "core";
import { formattedChatHistoryItem } from "./format";

interface CopyChatHistoryItemButtonProps {
  chatHistoryItem: ChatHistoryItem;
  tabIndex?: number;
  checkIconClassName?: string;
  logsIconClassName?: string;
}

export function CopyChatHistoryItemButton({
  chatHistoryItem,
  tabIndex,
  checkIconClassName = "h-4 w-4 text-green-400",
  logsIconClassName = "h-4 w-4 text-gray-400",
}: CopyChatHistoryItemButtonProps) {
  const [copied, setCopied] = useState<boolean>(false);

  const ideMessenger = useContext(IdeMessengerContext);

  const textVal = useMemo(() => {
    return formattedChatHistoryItem(chatHistoryItem)
  }, [chatHistoryItem])

  return (
    <>
      <ButtonWithTooltip
        tabIndex={tabIndex}
        text={copied ? "Copied!" : "Copy Logs"}
        onClick={(e) => {
          // const textVal = typeof text === "string" ? text : text();
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
          <QueueListIcon className={logsIconClassName} />
        )}
      </ButtonWithTooltip>
    </>
  );
}
