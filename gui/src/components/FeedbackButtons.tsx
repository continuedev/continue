import {
  HandThumbDownIcon,
  HandThumbUpIcon,
} from "@heroicons/react/24/outline";
import { ChatHistoryItem } from "core";
import { useContext, useState } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { useAppSelector } from "../redux/hooks";
import { selectSelectedChatModel } from "../redux/slices/configSlice";
import HeaderButtonWithToolTip from "./gui/HeaderButtonWithToolTip";

export interface FeedbackButtonsProps {
  item: ChatHistoryItem;
}

export function FeedbackButtons({ item }: FeedbackButtonsProps) {
  const [feedback, setFeedback] = useState<boolean | undefined>(undefined);
  const ideMessenger = useContext(IdeMessengerContext);
  const sessionId = useAppSelector((store) => store.session.id);
  const selectedChatModel = useAppSelector(selectSelectedChatModel);

  const sendFeedback = (feedback: boolean) => {
    setFeedback(feedback);
    if (item.promptLogs?.length) {
      for (const promptLog of item.promptLogs) {
        ideMessenger.post("devdata/log", {
          name: "chatFeedback",
          data: {
            ...promptLog,
            modelName: promptLog.modelTitle || "unknown",
            modelProvider: selectedChatModel?.underlyingProviderName || "unknown",
            feedback,
            sessionId,
          },
        });
      }
    }
  };

  return (
    <>
      <HeaderButtonWithToolTip
        text="Helpful"
        tabIndex={-1}
        onClick={() => sendFeedback(true)}
      >
        <HandThumbUpIcon
          className={`mx-0.5 h-3.5 w-3.5 ${feedback === true ? "text-success" : "text-description-muted"}`}
        />
      </HeaderButtonWithToolTip>
      <HeaderButtonWithToolTip
        text="Unhelpful"
        tabIndex={-1}
        onClick={() => sendFeedback(false)}
      >
        <HandThumbDownIcon
          className={`h-3.5 w-3.5 ${feedback === false ? "text-error" : "text-description-muted"}`}
        />
      </HeaderButtonWithToolTip>
    </>
  );
}
