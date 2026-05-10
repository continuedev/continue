// src/components/ThinkingBlockPeek.tsx
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { SparklesIcon } from "@heroicons/react/24/solid";
import { ChatHistoryItem } from "core";
import { useEffect, useRef, useState } from "react";
import styled from "styled-components";

import { AnimatedEllipsis } from "../../AnimatedEllipsis";
import StyledMarkdownPreview from "../../StyledMarkdownPreview";

const MarkdownWrapper = styled.div`
  & > div > *:first-child {
    margin-top: 0 !important;
  }
  & > div > *:last-child {
    margin-bottom: 0 !important;
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
  const [open, setOpen] = useState(!!inProgress);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string>("");
  const prevInProgress = useRef(!!inProgress);

  const duplicateRedactedThinkingBlock =
    prevItem &&
    prevItem.message.role === "thinking" &&
    redactedThinking &&
    prevItem.message.redactedThinking;

  // Auto-open while streaming, collapse when done (like Copilot)
  useEffect(() => {
    if (inProgress) {
      setOpen(true);
    } else if (prevInProgress.current) {
      // Was streaming, just finished → collapse
      setOpen(false);
    }
    prevInProgress.current = !!inProgress;
  }, [inProgress]);

  useEffect(() => {
    if (inProgress) {
      setStartTime(Date.now());
      setElapsedTime("");
    } else if (startTime) {
      const endTime = Date.now();
      const diff = endTime - startTime;
      setElapsedTime(`${(diff / 1000).toFixed(1)}s`);
    }
  }, [inProgress]);

  if (duplicateRedactedThinkingBlock) return null;

  const label = inProgress
    ? redactedThinking
      ? "Redacted Thinking"
      : "Thinking"
    : redactedThinking
      ? "Redacted Thinking"
      : elapsedTime
        ? `Thought for ${elapsedTime}${tokens ? ` · ${tokens} tokens` : ""}`
        : `Thinking${tokens ? ` · ${tokens} tokens` : ""}`;

  return (
    <div className="thread-message">
      <div className="mt-1 px-4">
        <div
          className="border-command-border bg-vsc-editor-background/40 overflow-hidden rounded-lg border border-solid"
          data-testid="thinking-block-peek"
        >
          {/* Header row */}
          <button
            type="button"
            aria-expanded={open}
            aria-controls={`thinking-block-content-${index}`}
            onClick={() => setOpen((p) => !p)}
            className="text-description hover:bg-vsc-input-background/60 flex w-full items-center gap-2 border-none bg-transparent px-3 py-2 text-left text-xs transition-colors"
          >
            <SparklesIcon
              className={`h-3.5 w-3.5 flex-shrink-0 transition-opacity ${inProgress ? "animate-pulse opacity-70" : "opacity-50"}`}
            />
            <span className="flex-1 font-medium">
              {label}
              {inProgress && <AnimatedEllipsis />}
            </span>
            {open ? (
              <ChevronUpIcon className="h-3.5 w-3.5 flex-shrink-0" />
            ) : (
              <ChevronDownIcon className="h-3.5 w-3.5 flex-shrink-0" />
            )}
          </button>

          {/* Collapsible body */}
          <div
            id={`thinking-block-content-${index}`}
            className={`border-command-border transition-all duration-200 ease-in-out ${
              open
                ? "max-h-[40vh] opacity-100"
                : "max-h-0 overflow-hidden opacity-0"
            }`}
          >
            <div className="border-command-border thin-scrollbar max-h-[40vh] overflow-y-auto border-t border-solid px-3 py-2.5">
              {redactedThinking ? (
                <p className="text-description m-0 text-xs italic">
                  Thinking content redacted due to safety reasons.
                </p>
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
      </div>
    </div>
  );
}

export default ThinkingBlockPeek;
