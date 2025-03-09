// src/components/ThinkingBlockPeek.tsx
import {
  ChevronDownIcon,
  ChevronRightIcon,
  LightBulbIcon,
} from "@heroicons/react/24/outline";
import { ChatHistoryItem } from "core";
import { useState } from "react";
import styled from "styled-components";
import { lightGray, vscBackground } from "..";
import StyledMarkdownPreview from "../markdown/StyledMarkdownPreview";

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
  signature?: string;
}

function ThinkingBlockPeek({
  content,
  redactedThinking,
  index,
  prevItem,
  signature,
}: ThinkingBlockPeekProps) {
  const [open, setOpen] = useState(false);

  const duplicateRedactedThinkingBlock =
    prevItem &&
    prevItem.message.role === "thinking" &&
    redactedThinking &&
    prevItem.message.redactedThinking;

  return duplicateRedactedThinkingBlock ? null : (
    <div className="thread-message">
      <div className="" style={{ backgroundColor: vscBackground }}>
        <div
          className="flex cursor-pointer items-center justify-start pl-2 text-xs text-gray-300"
          onClick={() => setOpen((prev) => !prev)}
          data-testid="thinking-block-peek"
        >
          <div className="relative mr-1 h-4 w-4">
            <ChevronRightIcon
              className={`absolute h-4 w-4 transition-all duration-200 ease-in-out text-[${lightGray}] ${
                open ? "rotate-90 opacity-0" : "rotate-0 opacity-100"
              }`}
            />
            <ChevronDownIcon
              className={`absolute h-4 w-4 transition-all duration-200 ease-in-out text-[${lightGray}] ${
                open ? "rotate-0 opacity-100" : "-rotate-90 opacity-0"
              }`}
            />
          </div>
          <LightBulbIcon className="mr-2 h-4 w-4 text-gray-400" />
          <span className="ml-1 text-xs text-gray-400 transition-colors duration-200">
            {redactedThinking ? "Redacted Thinking" : "AI Reasoning"}
          </span>
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
            <div className="pl-4 text-xs text-gray-400">
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
