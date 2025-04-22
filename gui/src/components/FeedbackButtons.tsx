import {
  HandThumbDownIcon,
  HandThumbUpIcon,
} from "@heroicons/react/24/outline";
import { ChatHistoryItem } from "core";
import { useContext } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { updateFeedback } from "../redux/slices/sessionSlice";
import { saveCurrentSession } from "../redux/thunks/session";
import HeaderButtonWithToolTip from "./gui/HeaderButtonWithToolTip";

export interface FeedbackButtonsProps {
  item: ChatHistoryItem;
}

export default function FeedbackButtons({ item }: FeedbackButtonsProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useAppDispatch();
  const sessionId = useAppSelector((store) => store.session.id);
  const feedback = item.feedback;

  const sendFeedback = (feedback: boolean) => {
    dispatch(updateFeedback({ 
      messageId: (item.message as any).id,
      feedback 
    }));

    if (item.promptLogs?.length) {
      for (const promptLog of item.promptLogs) {
        ideMessenger.post("devdata/log", {
          name: "chatFeedback",
          data: {
            ...promptLog,
            feedback,
            sessionId,
          },
        });
      }
    }

    dispatch(saveCurrentSession({ openNewSession: false, generateTitle: true }));
  };

  return (
    <>
      <HeaderButtonWithToolTip
        text="Helpful"
        tabIndex={-1}
        onClick={() => sendFeedback(true)}
      >
        <HandThumbUpIcon
          className={`mx-0.5 h-3.5 w-3.5 ${feedback === true ? "text-green-400" : "text-gray-500"}`}
        />
      </HeaderButtonWithToolTip>
      <HeaderButtonWithToolTip
        text="Unhelpful"
        tabIndex={-1}
        onClick={() => sendFeedback(false)}
      >
        <HandThumbDownIcon
          className={`h-3.5 w-3.5 ${feedback === false ? "text-red-400" : "text-gray-500"}`}
        />
      </HeaderButtonWithToolTip>
    </>
  );
}
