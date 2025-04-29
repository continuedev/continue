import { IndexingStatus } from "core";
import { ToolTip } from "../../../../gui/Tooltip";

interface StatusIndicatorProps {
  status?: IndexingStatus["status"];
  className?: string;
  size?: number;
  hoverMessage?: string;
}

const STATUS_TO_COLOR: Record<IndexingStatus["status"], string> = {
  indexing: "bg-yellow-500",
  paused: "bg-blue-500",
  complete: "bg-green-500",
  aborted: "bg-gray-500",
  pending: "bg-gray-300",
  failed: "bg-red-500",
};

export function StatusIndicator({
  status,
  className = "",
  size = 2,
  hoverMessage,
}: StatusIndicatorProps) {
  if (!status) return null;

  const indicator = (
    <div
      data-tooltip-id={hoverMessage ? "status-tooltip" : undefined}
      data-tooltip-content={hoverMessage}
      className={`h-${size} w-${size} rounded-full ${STATUS_TO_COLOR[status]} ${
        status === "indexing" ? "animate-pulse" : ""
      } ${className}`}
    />
  );

  return (
    <>
      {indicator}
      {hoverMessage && <ToolTip id="status-tooltip" />}
    </>
  );
}
