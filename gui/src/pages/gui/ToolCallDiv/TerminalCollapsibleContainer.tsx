import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { defaultBorderRadius } from "../../../components";

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
      {/* Collapsed State - Top indicator bar */}
      {!isExpanded && hiddenLinesCount > 0 && (
        <div
          className="absolute top-0 left-0 right-0 flex items-start justify-center pt-1"
          style={{
            height: '32px',
            zIndex: 10
          }}
        >
          <div
            className="flex items-center gap-2 rounded px-2 py-1 text-xs shadow-sm"
            style={{
              backgroundColor: 'var(--vscode-editor-background, #1e1e1e)',
              border: '1px solid var(--vscode-widget-border, #454545)',
              fontSize: '11px'
            }}
          >
            <span style={{ color: 'var(--vscode-descriptionForeground, #cccccc88)' }}>
              +{hiddenLinesCount} more lines
            </span>
            <ChevronDownIcon className="h-3 w-3" style={{ transform: 'rotate(180deg)', color: '#888888' }} />
          </div>
        </div>
      )}

      {/* Expanded State - Top indicator bar */}
      {isExpanded && collapsible && (
        <div
          className="absolute top-0 left-0 right-0 flex items-start justify-center pt-1"
          style={{
            height: '32px',
            zIndex: 10
          }}
        >
          <div
            className="flex items-center gap-2 rounded px-2 py-1 text-xs shadow-sm"
            style={{
              backgroundColor: 'var(--vscode-editor-background, #1e1e1e)',
              border: '1px solid var(--vscode-widget-border, #454545)',
              fontSize: '11px'
            }}
          >
            <span style={{ color: 'var(--vscode-descriptionForeground, #cccccc88)' }}>
              Collapse
            </span>
            <ChevronDownIcon className="h-3 w-3" style={{ color: '#888888' }} />
          </div>
        </div>
      )}

      {/* Clickable overlay covering the entire content area */}
      {collapsible && (
        <div
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="absolute inset-0 cursor-pointer"
          style={{
            zIndex: 20
          }}
        />
      )}

      {/* Content container with proper constraint for gradient */}
      <div
        className={`relative ${collapsible ? 'cursor-pointer' : ''}`}
        style={{
          borderRadius: defaultBorderRadius,
          overflow: 'hidden'
        }}
      >
        {/* Gradient overlay on top of content - only when collapsed */}
        {!isExpanded && hiddenLinesCount > 0 && (
          <div
            className="absolute pointer-events-none"
            style={{
              top: '16px', // Move further down from the top
              left: '9px', // 1px border + 8px padding from Ansi pre element
              right: '9px', // 1px border + 8px padding from Ansi pre element
              height: '100px',
              background: 'linear-gradient(to bottom, var(--vscode-editor-background, #1e1e1e), transparent)',
              borderTopLeftRadius: 'calc(' + defaultBorderRadius + ' - 1px)', // Slightly smaller radius to fit inside border
              borderTopRightRadius: 'calc(' + defaultBorderRadius + ' - 1px)',
              zIndex: 5
            }}
          />
        )}

        {isExpanded ? expandedContent : collapsedContent}
      </div>

    </div>
  );
}