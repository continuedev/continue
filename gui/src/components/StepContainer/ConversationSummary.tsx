import { TrashIcon } from "@heroicons/react/24/outline";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/solid";
import { ChatHistoryItem } from "core";
import { useState } from "react";
import { useAppSelector } from "../../redux/hooks";
import { useDeleteCompaction } from "../../util/compactConversation";
import { AnimatedEllipsis } from "../AnimatedEllipsis";
import HeaderButtonWithToolTip from "../gui/HeaderButtonWithToolTip";
import StyledMarkdownPreview from "../StyledMarkdownPreview";

interface ConversationSummaryProps {
  item: ChatHistoryItem;
  index: number;
}

export default function ConversationSummary(props: ConversationSummaryProps) {
  const [open, setOpen] = useState(true);
  const isLoading = useAppSelector(
    (state) => state.session.compactionLoading[props.index] || false,
  );
  const deleteCompaction = useDeleteCompaction();

  if (!props.item.conversationSummary && !isLoading) {
    return null;
  }

  // Loading state - much simpler
  if (isLoading) {
    return (
      <div className="mx-1.5 mb-4 mt-2">
        <div className="bg-vsc-input-background rounded-md shadow-sm">
          <div className="text-description flex items-center justify-start px-3 py-2 text-xs">
            <span>Generating conversation summary</span>
            <AnimatedEllipsis />
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
          className="text-description flex cursor-pointer items-center gap-2 px-3 py-2 text-xs transition-colors duration-200 hover:brightness-105"
          onClick={() => setOpen(!open)}
        >
          {open ? (
            <ChevronUpIcon className="h-3 w-3" />
          ) : (
            <ChevronDownIcon className="h-3 w-3" />
          )}
          <span className="flex-1">Conversation Summary</span>
          <HeaderButtonWithToolTip
            text="Delete summary"
            onClick={(e) => {
              e.stopPropagation();
              deleteCompaction(props.index);
            }}
          >
            <TrashIcon className="text-description-muted h-3 w-3" />
          </HeaderButtonWithToolTip>
        </div>
        {open && (
          <>
            <div className="border-border border-0 border-t border-solid"></div>
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
