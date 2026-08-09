import { useState } from "react";
import { IndicatorBar } from "./IndicatorBar";

interface TerminalCollapsibleContainerProps {
  collapsedContent: React.ReactNode;
  expandedContent: React.ReactNode;
  className?: string;
  collapsible?: boolean;
  hiddenLinesCount?: number;
}

export function TerminalCollapsibleContainer({
  collapsedContent,
  expandedContent,
  className = "",
  collapsible = false,
  hiddenLinesCount = 0,
}: TerminalCollapsibleContainerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!collapsible) {
    return <div className={className}>{collapsedContent}</div>;
  }

  return (
    <div className={`relative ${className}`}>
      {/* Indicator bar - shows for both collapsed and expanded states */}
      {((!isExpanded && hiddenLinesCount > 0) ||
        (isExpanded && collapsible)) && (
        <IndicatorBar
          text={isExpanded ? "Collapse" : `+${hiddenLinesCount} more lines`}
          isExpanded={isExpanded}
        />
      )}

      {/* Clickable overlay covering the entire content area */}
      {collapsible && (
        <div
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="absolute inset-0 z-20 cursor-pointer"
        />
      )}

      {/* Content container with proper constraint for gradient */}
      <div
        className={`relative overflow-hidden rounded-lg ${collapsible ? "cursor-pointer" : ""}`}
      >
        {/* Gradient overlay on top of content - only when collapsed */}
        {!isExpanded && hiddenLinesCount > 0 && (
          <div className="from-editor pointer-events-none absolute left-[9px] right-[9px] top-4 z-[5] h-[100px] rounded-t-md bg-gradient-to-b to-transparent" />
        )}

        {isExpanded ? expandedContent : collapsedContent}
      </div>
    </div>
  );
}
