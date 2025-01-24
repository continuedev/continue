import { ChatHistoryItem } from "core";
import { stripImages } from "core/util/messageContent";
import { useEffect, useState } from "react";
import styled from "styled-components";
import { defaultBorderRadius, lightGray, vscBackground, vscQuickInputBackground, } from "..";
import { getFontSize } from "../../util";
import StyledMarkdownPreview from "../markdown/StyledMarkdownPreview";

interface ReasoningProps {
  item: ChatHistoryItem;
  index: number;
  isLast: boolean;
}

const SpoilerButton = styled.div`
  background-color: ${vscBackground};
  width: fit-content;
  font-size: ${getFontSize() - 2}px;
  border: 0.5px solid ${lightGray};
  border-radius: ${defaultBorderRadius};
  padding: 4px 8px;
  color: ${lightGray};
  cursor: pointer;
  box-shadow:
    0 4px 6px rgba(0, 0, 0, 0.1),
    0 1px 3px rgba(0, 0, 0, 0.08);
  transition: box-shadow 0.3s ease;

  &:hover {
    box-shadow:
      0 6px 8px rgba(0, 0, 0, 0.15),
      0 3px 6px rgba(0, 0, 0, 0.1);
  }
`;

const ContentDiv = styled.div<{ fontSize?: number }>`
  margin: 4px;
  padding: 4px;
  font-size: ${getFontSize()}px;
  overflow: hidden;
  border-left: 4px solid ${lightGray};
  border-radius: ${defaultBorderRadius};
  background-color: ${vscQuickInputBackground};
`;

export default function Reasoning(props: ReasoningProps) {
  const [open, setOpen] = useState(false);
  const [reasoningTime, setReasoningTime] = useState("");

  useEffect(() => {
    if (!props.item.reasoning) return;

    const interval = setInterval(() => {
      const startAt = props.item.reasoning?.startAt || Date.now();
      const endAt = props.item.reasoning?.endAt || Date.now();
      const diff = endAt - startAt;
      const diffString = `${(diff / 1000).toFixed(1)}s`;
      setReasoningTime(diffString)
    }, 100);

    return () => clearInterval(interval);
  }, [props.item.reasoning?.startAt, props.item.reasoning?.endAt])

  if (!props.item.reasoning?.text) {
    return null;
  }

  return <>
    <SpoilerButton onClick={() => setOpen(!open)}> {open ? "Hide" : "Show"}  reasoning: {reasoningTime} </SpoilerButton>
    {open && (<ContentDiv>
      <StyledMarkdownPreview
        isRenderingInStepContainer
        source={stripImages(props.item.reasoning.text)}
        itemIndex={props.index}
        useParentBackgroundColor
      />
    </ContentDiv>)}
  </>
}
