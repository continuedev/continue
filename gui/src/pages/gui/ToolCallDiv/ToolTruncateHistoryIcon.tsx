import { BarsArrowUpIcon } from "@heroicons/react/24/outline";
import { chatMessageIsEmpty } from "core/llm/messages";
import { findLastIndex } from "core/util/findLast";
import { useMemo } from "react";
import { ToolTip } from "../../../components/gui/Tooltip";
import { useMainEditor } from "../../../components/mainInput/TipTapEditor";
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

  const truncateTooltipId = useMemo(() => {
    return "truncate-hover-" + historyIndex;
  }, [historyIndex]);

  if (historyIndex === lastMessageIndex) {
    return null;
  }

  return (
    <>
      <div
        data-tooltip-id={truncateTooltipId}
        onClick={(e) => {
          e.stopPropagation();
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
        className={`hover:description-muted/30 cursor-pointer select-none rounded px-1 py-0.5 hover:opacity-80 ${isStreaming ? "cursor-not-allowed opacity-50" : "bg-transparent"}`}
      >
        <BarsArrowUpIcon className="h-3 w-3 flex-shrink-0 opacity-60" />
      </div>
      <ToolTip id={truncateTooltipId}>
        {isStreaming ? "" : "Trim chat to this message"}
      </ToolTip>
    </>
  );
}
