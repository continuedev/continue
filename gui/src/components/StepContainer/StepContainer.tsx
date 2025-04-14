import { ChatHistoryItem } from "core";
import { renderChatMessage, stripImages } from "core/util/messageContent";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import styled from "styled-components";
import { vscBackground } from "..";
import { useAppSelector } from "../../redux/hooks";
import { selectUIConfig } from "../../redux/slices/configSlice";
import { deleteMessage } from "../../redux/slices/sessionSlice";
import { getFontSize } from "../../util";
import StyledMarkdownPreview from "../StyledMarkdownPreview";
import Reasoning from "./Reasoning";
import ResponseActions from "./ResponseActions";
import ThinkingIndicator from "./ThinkingIndicator";

interface StepContainerProps {
  item: ChatHistoryItem;
  index: number;
  isLast: boolean;
}

const ContentDiv = styled.div<{ fontSize?: number }>`
  padding: 4px;
  padding-left: 6px;
  padding-right: 6px;

  background-color: ${vscBackground};
  font-size: ${getFontSize()}px;
  overflow: hidden;
`;

export default function StepContainer(props: StepContainerProps) {
  const dispatch = useDispatch();
  const [isTruncated, setIsTruncated] = useState(false);
  const isStreaming = useAppSelector((state) => state.session.isStreaming);
  const historyItemAfterThis = useAppSelector(
    (state) => state.session.history[props.index + 1],
  );
  const uiConfig = useAppSelector(selectUIConfig);

  const hideActionSpace =
    historyItemAfterThis?.message.role === "assistant" ||
    historyItemAfterThis?.message.role === "thinking";
  const hideActions = hideActionSpace || (isStreaming && props.isLast);

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
      <ContentDiv>
        {uiConfig?.displayRawMarkdown ? (
          <pre
            className="max-w-full overflow-x-auto whitespace-pre-wrap break-words p-4"
            style={{ fontSize: getFontSize() - 2 }}
          >
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
      </ContentDiv>
      {/* We want to occupy space in the DOM regardless of whether the actions are visible to avoid jank on stream complete */}
      {!hideActionSpace && (
        <div className={`mt-2 h-7 transition-opacity duration-300 ease-in-out`}>
          {!hideActions && (
            <ResponseActions
              isTruncated={isTruncated}
              onDelete={onDelete}
              onContinueGeneration={onContinueGeneration}
              index={props.index}
              item={props.item}
            />
          )}
        </div>
      )}
    </div>
  );
}
