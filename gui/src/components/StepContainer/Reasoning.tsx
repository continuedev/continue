import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/solid";
import { ChatHistoryItem } from "core";
import { stripImages } from "core/util/messageContent";
import { useEffect, useState } from "react";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  vscBackground,
  vscQuickInputBackground,
} from "..";
import { getFontSize } from "../../util";
import StyledMarkdownPreview from "../StyledMarkdownPreview";

interface ReasoningProps {
  item: ChatHistoryItem;
  index: number;
  isLast: boolean;
}

const SpoilerButton = styled.div`
  margin: 8px 6px 16px 6px;
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

const ButtonContent = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const ContentDiv = styled.div<{ fontSize?: number }>`
  margin: 4px;
  padding: 4px;
  padding-bottom: 8px;
  font-size: ${getFontSize()}px;
  overflow: hidden;
  border-left: 4px solid ${lightGray};
  border-radius: ${defaultBorderRadius};
  background-color: ${vscQuickInputBackground};
`;

const ThinkingText = styled.span`
  position: relative;
  padding-right: 12px;

  &:after {
    content: "...";
    position: absolute;
    animation: ellipsis 1s steps(4, end) infinite;
    width: 0px;
    display: inline-block;
    overflow: hidden;
  }

  @keyframes ellipsis {
    0%,
    100% {
      width: 0px;
    }
    33% {
      width: 8px;
    }
    66% {
      width: 16px;
    }
    90% {
      width: 24px;
    }
  }
`;

export default function Reasoning(props: ReasoningProps) {
  const [open, setOpen] = useState(false);
  const [reasoningTime, setReasoningTime] = useState("");
  const isThinking = !props.item.reasoning?.endAt;

  useEffect(() => {
    if (!props.item.reasoning) return;
    if (!props.item.reasoning?.endAt) return;

    const startAt = props.item.reasoning?.startAt || Date.now();
    const endAt = props.item.reasoning?.endAt || Date.now();
    const diff = endAt - startAt;
    const diffString = `${(diff / 1000).toFixed(1)}s`;
    setReasoningTime(diffString);
  }, [props.item.reasoning?.startAt, props.item.reasoning?.endAt]);

  if (!props.item.reasoning?.text) {
    return null;
  }

  return (
    <>
      <SpoilerButton onClick={() => setOpen(!open)}>
        <ButtonContent>
          {isThinking ? (
            <ThinkingText>Thinking</ThinkingText>
          ) : (
            `Thought for ${reasoningTime}`
          )}
          {open ? (
            <ChevronUpIcon className="h-3 w-3" />
          ) : (
            <ChevronDownIcon className="h-3 w-3" />
          )}
        </ButtonContent>
      </SpoilerButton>
      {open && (
        <ContentDiv>
          <StyledMarkdownPreview
            isRenderingInStepContainer
            source={stripImages(props.item.reasoning.text)}
            itemIndex={props.index}
            useParentBackgroundColor
          />
        </ContentDiv>
      )}
    </>
  );
}
