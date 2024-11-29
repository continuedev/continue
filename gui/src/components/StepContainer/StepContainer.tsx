import { ChatHistoryItem } from "core";
import { stripImages } from "core/llm/images";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import styled from "styled-components";
import { vscBackground } from "..";
import { deleteMessage } from "../../redux/slices/stateSlice";
import { getFontSize } from "../../util";
import StyledMarkdownPreview from "../markdown/StyledMarkdownPreview";
import ResponseActions from "./ResponseActions";
import { useAppSelector } from "../../redux/hooks";
import { selectUIConfig } from "../../redux/slices/configSlice";

interface StepContainerProps {
  item: ChatHistoryItem;
  index: number;
  isLast: boolean;
}

const ContentDiv = styled.div<{ fontSize?: number }>`
  padding-top: 4px;
  background-color: ${vscBackground};
  font-size: ${getFontSize()}px;
  overflow: hidden;
`;

export default function StepContainer(props: StepContainerProps) {
  const dispatch = useDispatch();
  const [isTruncated, setIsTruncated] = useState(false);
  const isStreaming = useAppSelector((store) => store.session.isStreaming);
  // const curCheckpointIndex = useAppSelector(
  //   (store: RootState) => store.state.curCheckpointIndex,
  // );
  // const isInEditMode = useSelector(
  //   (store: RootState) => store.editModeState.isInEditMode,
  // );
  const uiConfig = useAppSelector(selectUIConfig);
  const shouldHideActions = isStreaming && props.isLast;

  // const isStepAheadOfCurCheckpoint =
  //   isInEditMode && Math.floor(props.index / 2) > curCheckpointIndex;

  useEffect(() => {
    if (!isStreaming) {
      const content = stripImages(props.item.message.content).trim();
      const endingPunctuation = [".", "?", "!", "```"];

      // If not ending in punctuation or emoji, we assume the response got truncated
      if (
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
    <div
      // className={isStepAheadOfCurCheckpoint ? "opacity-25" : "relative"}
      style={{
        minHeight: props.isLast ? "50vh" : 0,
      }}
    >
      <ContentDiv>
        {uiConfig?.displayRawMarkdown ? (
          <pre
            className="max-w-full overflow-x-auto whitespace-pre-wrap break-words p-4"
            style={{ fontSize: getFontSize() - 2 }}
          >
            {stripImages(props.item.message.content)}
          </pre>
        ) : (
          <StyledMarkdownPreview
            isRenderingInStepContainer
            source={stripImages(props.item.message.content)}
            itemIndex={props.index}
          />
        )}
      </ContentDiv>
      {/* We want to occupy space in the DOM regardless of whether the actions are visible to avoid jank on */}
      <div className={`mt-2 h-7 transition-opacity duration-300 ease-in-out`}>
        {!shouldHideActions && (
          <ResponseActions
            isTruncated={isTruncated}
            onDelete={onDelete}
            onContinueGeneration={onContinueGeneration}
            index={props.index}
            item={props.item}
          />
        )}
      </div>
    </div>
  );
}
