import { useState } from "react";
import { defaultBorderRadius } from "../../../components";
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
      {((!isExpanded && hiddenLinesCount > 0) || (isExpanded && collapsible)) && (
        <IndicatorBar 
          text={isExpanded ? 'Collapse' : `+${hiddenLinesCount} more lines`}
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
          className="absolute inset-0 cursor-pointer z-20"
        />
      )}

      {/* Content container with proper constraint for gradient */}
      <div
        className={`relative overflow-hidden ${collapsible ? 'cursor-pointer' : ''}`}
        style={{ borderRadius: defaultBorderRadius }}
      >
        {/* Gradient overlay on top of content - only when collapsed */}
        {!isExpanded && hiddenLinesCount > 0 && (
          <div
            className="absolute pointer-events-none top-4 left-[9px] right-[9px] h-[100px] z-[5]"
            style={{
              background: 'linear-gradient(to bottom, var(--vscode-editor-background, #1e1e1e), transparent)',
              borderTopLeftRadius: `calc(${defaultBorderRadius} - 1px)`,
              borderTopRightRadius: `calc(${defaultBorderRadius} - 1px)`
            }}
          />
        )}

        {isExpanded ? expandedContent : collapsedContent}
      </div>

    </div>
  );
}