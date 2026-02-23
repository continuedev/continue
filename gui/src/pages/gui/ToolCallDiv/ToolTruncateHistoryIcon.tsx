import { BarsArrowUpIcon } from "@heroicons/react/24/outline";
import { chatMessageIsEmpty } from "core/llm/messages";
import { findLastIndex } from "core/util/findLast";
import { useMemo } from "react";
import { useMainEditor } from "../../../components/mainInput/TipTapEditor";
import { ToolbarButtonWithTooltip } from "../../../components/StyledMarkdownPreview/StepContainerPreToolbar/ToolbarButtonWithTooltip";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { truncateHistoryToMessage } from "../../../redux/slices/sessionSlice";

export function ToolTruncateHistoryIcon({
  historyIndex,
}: {
  historyIndex: number;
}) {
  const isStreaming = useAppSelector((state) => state.session.isStreaming);
  const history = useAppSelector((state) => state.session.history);
  const lastMessageIndex = useMemo(() => {
    return findLastIndex(history, (item) => !chatMessageIsEmpty(item.message));
  }, [history]);
  const dispatch = useAppDispatch();
  const { mainEditor } = useMainEditor();

  if (historyIndex === lastMessageIndex) {
    // filler so doesn't jump in
    return <div className="h-3 w-3" />;
  }

  return (
    <ToolbarButtonWithTooltip
      tooltipContent={isStreaming ? "" : "Trim chat to this message"}
      onClick={() => {
        if (isStreaming) {
          return;
        }
        dispatch(
          truncateHistoryToMessage({
            index: historyIndex,
          }),
        );
        mainEditor?.commands.focus();
      }}
    >
      <BarsArrowUpIcon
        className={`h-3 w-3 flex-shrink-0 opacity-60 ${isStreaming ? "cursor-not-allowed" : ""}`}
      />
    </ToolbarButtonWithTooltip>
  );
}
