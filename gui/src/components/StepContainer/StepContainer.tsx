import { ChatHistoryItem } from "core";
import { renderChatMessage, stripImages } from "core/util/messageContent";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useAppSelector } from "../../redux/hooks";
import { selectUIConfig } from "../../redux/slices/configSlice";
import { deleteMessage } from "../../redux/slices/sessionSlice";
import StyledMarkdownPreview from "../StyledMarkdownPreview";
import ConversationSummary from "./ConversationSummary";
import Reasoning from "./Reasoning";
import ResponseActions from "./ResponseActions";
import ThinkingIndicator from "./ThinkingIndicator";
import UserMessageActions from "./UserMessageActions";

interface StepContainerProps {
  item: ChatHistoryItem;
  index: number;
  isLast: boolean;
  latestSummaryIndex?: number;
}

export default function StepContainer(props: StepContainerProps) {
  const dispatch = useDispatch();
  const [isTruncated, setIsTruncated] = useState(false);
  const isStreaming = useAppSelector((state) => state.session.isStreaming);
  const uiConfig = useAppSelector(selectUIConfig);

  // Calculate dimming and indicator state based on latest summary index
  const latestSummaryIndex = props.latestSummaryIndex ?? -1;
  const isBeforeLatestSummary =
    latestSummaryIndex !== -1 && props.index <= latestSummaryIndex;
  const isLatestSummary =
    latestSummaryIndex !== -1 && props.index === latestSummaryIndex;

  const historyItemAfterThis = useAppSelector(
    (state) => state.session.history[props.index + 1],
  );

  const isNextMsgAssistantOrThinking =
    historyItemAfterThis?.message.role === "assistant" ||
    historyItemAfterThis?.message.role === "thinking" ||
    historyItemAfterThis?.message.role === "tool";

  const shouldRenderResponseAction = () => {
    // Only for assistant messages
    if (props.item.message.role !== "assistant") return false;

    // Hide when next is assistant/thinking/tool
    if (isNextMsgAssistantOrThinking) return false;

    // If this is the last message, only show when not streaming and no tool calls
    if (props.isLast) {
      return !isStreaming && !props.item.toolCallStates;
    }

    // For non-last messages, only show if the next message is a user message
    return historyItemAfterThis?.message.role === "user";
  };

  const shouldRenderUserMessageActions = () => {
    // Show actions for user messages when not streaming
    return props.item.message.role === "user";
  };
  const showResponseActions =
    (props.isLast || historyItemAfterThis?.message.role === "user") &&
    !(props.isLast && (isStreaming || props.item.toolCallStates));

  useEffect(() => {
    if (!isStreaming) {
      const content = renderChatMessage(props.item.message).trim();
      const endingPunctuation = [".", "?", "!", "```", ":"];

      // If not ending in punctuation or emoji, we assume the response got truncated
      if (
        content.trim() !== "" &&
        !(
          endingPunctuation.some((p) => content.endsWith(p)) ||
          /\p{Emoji}/u.test(content.slice(-2))
        )
      ) {
        setIsTruncated(true);
      } else {
        setIsTruncated(false);
      }
    }
  }, [props.item.message.content, isStreaming]);

  function onDelete() {
    dispatch(deleteMessage(props.index));
  }

  function onContinueGeneration() {
    window.postMessage(
      {
        messageType: "userInput",
        data: {
          input: "Continue your response exactly where you left off:",
        },
      },
      "*",
    );
  }

  return (
    <div>
      <div
        className={`bg-background p-1 px-1.5 ${isBeforeLatestSummary ? "opacity-35" : ""}`}
      >
        {uiConfig?.displayRawMarkdown ? (
          <pre className="text-2xs max-w-full overflow-x-auto whitespace-pre-wrap break-words p-4">
            {renderChatMessage(props.item.message)}
          </pre>
        ) : (
          <>
            <Reasoning {...props} />

            <StyledMarkdownPreview
              isRenderingInStepContainer
              source={stripImages(props.item.message.content)}
              itemIndex={props.index}
            />
          </>
        )}
        {props.isLast && <ThinkingIndicator historyItem={props.item} />}
      </div>

      {shouldRenderResponseAction() && (
        <div
          className={`mt-2 h-7 transition-opacity duration-300 ease-in-out ${isBeforeLatestSummary || isStreaming ? "opacity-35" : ""} ${isStreaming && "pointer-events-none cursor-not-allowed"}`}
        >
          <ResponseActions
            isTruncated={isTruncated}
            onDelete={onDelete}
            onContinueGeneration={onContinueGeneration}
            index={props.index}
            item={props.item}
            isLast={props.isLast}
          />
        </div>
      )}

      {shouldRenderUserMessageActions() && (
        <div
          className={`mt-2 h-7 transition-opacity duration-300 ease-in-out ${isBeforeLatestSummary ? "opacity-35" : ""}`}
        >
          <UserMessageActions index={props.index} item={props.item} />
        </div>
      )}

      {/* Show compaction indicator for the latest summary */}
      {isLatestSummary && (
        <div className="mx-1.5 my-5">
          <div className="flex items-center">
            <div className="border-border flex-1 border-t border-solid"></div>
            <span className="text-description mx-3 text-xs">
              Previous Conversation Compacted
            </span>
            <div className="border-border flex-1 border-t border-solid"></div>
          </div>
        </div>
      )}

      {/* ConversationSummary is outside the dimmed container so it's always at full opacity */}
      <ConversationSummary item={props.item} index={props.index} />
    </div>
  );
}
