import {
  HandThumbDownIcon,
  HandThumbUpIcon,
} from "@heroicons/react/24/outline";
import { ChatHistoryItem } from "core";
import { useContext, useState } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { useAppSelector } from "../redux/hooks";
import HeaderButtonWithToolTip from "./gui/HeaderButtonWithToolTip";

export interface FeedbackButtonsProps {
  item: ChatHistoryItem;
}

export function FeedbackButtons({ item }: FeedbackButtonsProps) {
  const [feedback, setFeedback] = useState<boolean | undefined>(undefined);
  const ideMessenger = useContext(IdeMessengerContext);
  const sessionId = useAppSelector((store) => store.session.id);

  const sendFeedback = (feedback: boolean) => {
    setFeedback(feedback);
    if (item.promptLogs?.length) {
      for (const promptLog of item.promptLogs) {
        const { modelTitle, modelProvider, ...logData } = promptLog;
        ideMessenger.post("devdata/log", {
          name: "chatFeedback",
          data: {
            ...logData,
            completionOptions: {}, // TODO delete completionOptions from @continuedev/config-yaml
            modelProvider: modelProvider || "unknown",
            modelName: modelTitle,
            modelTitle: modelTitle,
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
