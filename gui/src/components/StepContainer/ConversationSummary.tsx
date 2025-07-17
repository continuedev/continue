import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/solid";
import { ChatHistoryItem } from "core";
import { useState } from "react";
import { useAppSelector } from "../../redux/hooks";
import StyledMarkdownPreview from "../StyledMarkdownPreview";

interface ConversationSummaryProps {
  item: ChatHistoryItem;
  index: number;
}

export default function ConversationSummary(props: ConversationSummaryProps) {
  const [open, setOpen] = useState(false);
  const isLoading = useAppSelector(
    (state) => state.session.compactionLoading[props.index] || false,
  );

  if (!props.item.conversationSummary && !isLoading) {
    return null;
  }

  // Loading state - much simpler
  if (isLoading) {
    return (
      <div className="mx-1.5 mb-4 mt-2">
        <div className="bg-vsc-input-background rounded-md shadow-sm">
          <div className="text-description flex items-center justify-start px-3 py-2 text-xs">
            <div className="bg-lightgray h-3 w-3 animate-pulse rounded-full"></div>
            <span className="ml-2">Generating conversation summary...</span>
          </div>
        </div>
      </div>
    );
  }

  // Normal state with content
  return (
    <div className="mx-1.5 mb-4 mt-2">
      <div className="bg-vsc-input-background rounded-md shadow-sm">
        <div
          className="text-description flex cursor-pointer items-center justify-between px-3 py-2 text-xs transition-colors duration-200 hover:brightness-105"
          onClick={() => setOpen(!open)}
        >
          <div className="flex items-center gap-2">
            <div className="bg-lightgray h-3 w-3 rounded-full"></div>
            <span>Conversation Summary</span>
          </div>
          {open ? (
            <ChevronUpIcon className="h-3 w-3" />
          ) : (
            <ChevronDownIcon className="h-3 w-3" />
          )}
        </div>
        {open && (
          <>
            <div className="border-0 border-t border-solid border-border"></div>
            <div className="max-h-[400px] overflow-y-auto px-3 pb-3 pt-2">
              <StyledMarkdownPreview
                isRenderingInStepContainer
                source={props.item.conversationSummary}
                itemIndex={props.index}
                useParentBackgroundColor
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
