// src/components/ThinkingBlockPeek.tsx
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { ChevronUpIcon } from "@heroicons/react/24/solid";
import { ChatHistoryItem } from "core";
import { useEffect, useState } from "react";
import styled from "styled-components";

import { defaultBorderRadius, lightGray, vscBackground } from "../..";
import { getFontSize } from "../../../util";
import { AnimatedEllipsis } from "../../AnimatedEllipsis";
import StyledMarkdownPreview from "../../StyledMarkdownPreview";

const SpoilerButton = styled.div`
  background-color: ${vscBackground};
  width: fit-content;
  margin: 8px 6px 0px 2px;
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

const ThinkingTextContainer = styled.span`
  display: inline-block;
  min-width: fit-content;

  padding-right: 1em; /* Reserve space for the ellipsis animation */
`;

const MarkdownWrapper = styled.div`
  & > div > *:first-child {
    margin-top: 0 !important;
  }
`;

interface ThinkingBlockPeekProps {
  content: string;
  redactedThinking?: string;
  index: number;
  prevItem: ChatHistoryItem | null;
  inProgress?: boolean;
  signature?: string;
  tokens?: number;
}

function ThinkingBlockPeek({
  content,
  redactedThinking,
  index,
  prevItem,
  inProgress,
  signature,
  tokens,
}: ThinkingBlockPeekProps) {
  const [open, setOpen] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string>("");

  const duplicateRedactedThinkingBlock =
    prevItem &&
    prevItem.message.role === "thinking" &&
    redactedThinking &&
    prevItem.message.redactedThinking;

  useEffect(() => {
    if (inProgress) {
      setStartTime(Date.now());
      setElapsedTime("");
    } else if (startTime) {
      const endTime = Date.now();
      const diff = endTime - startTime;
      const diffString = `${(diff / 1000).toFixed(1)}s`;
      setElapsedTime(diffString);
    }
  }, [inProgress]);

  return duplicateRedactedThinkingBlock ? null : (
    <div className="thread-message">
      <div className="" style={{ backgroundColor: vscBackground }}>
        <div
          className="flex items-center justify-start pl-2 text-xs text-gray-300"
          data-testid="thinking-block-peek"
        >
          <SpoilerButton onClick={() => setOpen(!open)}>
            <ButtonContent>
              {inProgress ? (
                <span>
                  {redactedThinking ? "Redacted Thinking" : "Thinking"}
                  <AnimatedEllipsis />
                </span>
              ) : redactedThinking ? (
                "Redacted Thinking"
              ) : (
                "Thought" +
                (elapsedTime ? ` for ${elapsedTime}` : "") +
                (tokens ? ` (${tokens} tokens)` : "")
              )}
              {open ? (
                <ChevronUpIcon className="h-3 w-3" />
              ) : (
                <ChevronDownIcon className="h-3 w-3" />
              )}
            </ButtonContent>
          </SpoilerButton>
        </div>
        <div
          className={`ml-2 mt-2 overflow-y-auto transition-none duration-300 ease-in-out ${
            open ? "mb-2 mt-5 opacity-100" : "max-h-0 border-0 opacity-0"
          }`}
          style={{
            borderLeft:
              open && !redactedThinking
                ? "2px solid var(--vscode-input-border, #606060)"
                : "none",
          }}
        >
          {redactedThinking ? (
            <div className="text-description-muted pl-4 text-xs">
              Thinking content redacted due to safety reasons.
            </div>
          ) : (
            <>
              <MarkdownWrapper className="-mt-1 px-0 pl-1">
                <StyledMarkdownPreview
                  isRenderingInStepContainer
                  source={content}
                  itemIndex={index}
                />
              </MarkdownWrapper>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ThinkingBlockPeek;
