import { ChatHistoryItem } from "core";
import { stripImages } from "core/llm/images";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import styled from "styled-components";
import { vscBackground } from "..";
import useUIConfig from "../../hooks/useUIConfig";
import { RootState } from "../../redux/store";
import { getFontSize } from "../../util";
import StyledMarkdownPreview from "../markdown/StyledMarkdownPreview";
import ResponseActions from "./ResponseActions";
import { deleteMessage } from "../../redux/slices/stateSlice";

interface StepContainerProps {
  item: ChatHistoryItem;
  onContinueGeneration: () => void;
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
  const active = useSelector((store: RootState) => store.state.active);
  const curCheckpointIndex = useSelector(
    (store: RootState) => store.state.curCheckpointIndex,
  );
  const uiConfig = useUIConfig();
  const shouldRenderActions = !active || !props.isLast;
  const shouldHideStep = props.index > curCheckpointIndex * 2 + 1;
  console.log({ index: props.index, curCheckpointIndex });

  useEffect(() => {
    if (!active) {
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
  }, [props.item.message.content, active]);

  function onDelete() {
    dispatch(deleteMessage(props.index));
  }

  return (
    <div
      className={shouldHideStep ? "hidden" : "relative"}
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
          />
        )}
      </ContentDiv>
      {/* We want to occupy space in the DOM regardless of whether the actions are visible to avoid jank on */}
      <div
        className={`${shouldRenderActions ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"} transition-opacity duration-300 ease-in-out`}
      >
        {shouldRenderActions && (
          <ResponseActions
            isLast={props.isLast}
            isTruncated={isTruncated}
            onDelete={onDelete}
            onContinueGeneration={props.onContinueGeneration}
            index={props.index}
            item={props.item}
          />
        )}
      </div>
    </div>
  );
}
