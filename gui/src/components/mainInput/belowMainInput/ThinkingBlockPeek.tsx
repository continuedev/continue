// src/components/ThinkingBlockPeek.tsx
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { ChevronUpIcon } from "@heroicons/react/24/solid";
import { ChatHistoryItem } from "core";
import { useEffect, useState } from "react";
import styled from "styled-components";

import { vscBackground } from "../..";
import { AnimatedEllipsis } from "../../AnimatedEllipsis";
import StyledMarkdownPreview from "../../StyledMarkdownPreview";

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
      <div className="mt-1 flex flex-col px-4">
        <div className="flex min-w-0 flex-row items-center justify-between gap-2">
          <button
            type="button"
            className="text-description hover:text- flex min-w-0 cursor-pointer flex-row items-center gap-1.5 border-0 text-xs shadow-none transition-colors duration-200 ease-in-out"
            style={{ backgroundColor: vscBackground }}
            data-testid="thinking-block-peek"
            aria-expanded={open}
            aria-controls={`thinking-block-content-${index}`}
            onClick={() => setOpen(!open)}
          >
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
          </button>
        </div>
        <div
          id={`thinking-block-content-${index}`}
          className={`mt-2 overflow-y-auto transition-all duration-300 ease-in-out ${
            open ? "max-h-[50vh] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          {redactedThinking ? (
            <div className="text-description pl-5 text-xs italic">
              Thinking content redacted due to safety reasons.
            </div>
          ) : (
            <MarkdownWrapper>
              <StyledMarkdownPreview
                isRenderingInStepContainer
                source={content}
                itemIndex={index}
              />
            </MarkdownWrapper>
          )}
        </div>
      </div>
    </div>
  );
}

export default ThinkingBlockPeek;
