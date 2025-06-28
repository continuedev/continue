import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { ToolbarButtonWithTooltip } from "../../../components/StyledMarkdownPreview/StepContainerPreToolbar/ToolbarButtonWithTooltip";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { truncateHistoryToMessage } from "../../../redux/slices/sessionSlice";

export function TruncateHistoryIcon({
  historyIndex,
}: {
  historyIndex: number;
}) {
  const isStreaming = useAppSelector((state) => state.session.isStreaming);
  const history = useAppSelector((state) => state.session.history);
  const dispatch = useAppDispatch();
  if (isStreaming || historyIndex === history.length - 1) {
    return null;
  }
  return (
    <ToolbarButtonWithTooltip
      tooltipContent="Truncate chat to this message"
      onClick={() => {
        dispatch(
          truncateHistoryToMessage({
            index: historyIndex,
          }),
        );
      }}
    >
      <ArrowUpTrayIcon className="h-2.5 w-2.5" />
    </ToolbarButtonWithTooltip>
  );
}
