import {
  ChevronDownIcon,
  ChevronUpIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { Tool, ToolCallState } from "core";
import { useEffect, useRef, useState } from "react";
import { ToolCallStatusMessage } from "./ToolCallStatusMessage";
import { ToolTruncateHistoryIcon } from "./ToolTruncateHistoryIcon";

interface ToolCallDisplayProps {
  children: React.ReactNode;
  icon: React.ReactNode;
  tool: Tool | undefined;
  toolCallState: ToolCallState;
  historyIndex: number;
}

export function ToolCallDisplay({
  icon,
  tool,
  toolCallState,
  children,
  historyIndex,
}: ToolCallDisplayProps) {
  const isActive =
    toolCallState.status === "calling" || toolCallState.status === "generating";

  const [open, setOpen] = useState(isActive);
  const prevIsActive = useRef(isActive);

  // Auto-collapse when the call completes (mirrors ThinkingBlockPeek)
  useEffect(() => {
    if (isActive) {
      setOpen(true);
    } else if (prevIsActive.current) {
      setOpen(false);
    }
    prevIsActive.current = isActive;
  }, [isActive]);

  const bodyId = `tool-call-display-body-${toolCallState.toolCallId}`;

  return (
    <div className="mt-1 flex flex-col px-4" data-testid="tool-call-display">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((p) => !p)}
          data-testid="tool-call-display-header"
          className="text-description hover:bg-[color:var(--vscode-input-background)]/40 flex min-w-0 flex-1 items-center gap-1.5 rounded-md border-none bg-transparent px-2 py-1.5 text-left text-xs transition-colors"
        >
          <span className="mt-[1px] flex h-4 w-4 flex-shrink-0 items-center justify-center">
            {tool?.faviconUrl ? (
              <img
                src={tool.faviconUrl}
                alt=""
                className="h-4 w-4 rounded-sm"
              />
            ) : icon ? (
              icon
            ) : (
              <WrenchScrewdriverIcon
                className={`h-4 w-4 ${isActive ? "animate-pulse" : ""}`}
              />
            )}
          </span>

          <span className="min-w-0 flex-1">
            <ToolCallStatusMessage tool={tool} toolCallState={toolCallState} />
          </span>

          <span className="flex-shrink-0 opacity-60">
            {open ? (
              <ChevronUpIcon className="h-3.5 w-3.5" />
            ) : (
              <ChevronDownIcon className="h-3.5 w-3.5" />
            )}
          </span>
        </button>

        {!!toolCallState.output?.length && (
          <ToolTruncateHistoryIcon historyIndex={historyIndex} />
        )}
      </div>

      {/* Collapsible body */}
      <div
        id={bodyId}
        className={`transition-all duration-200 ease-in-out ${
          open
            ? "max-h-[50vh] opacity-100"
            : "max-h-0 overflow-hidden opacity-0"
        }`}
      >
        <div className="thin-scrollbar max-h-[50vh] overflow-y-auto pb-1 pl-5 pr-1 pt-1">
          {children}
        </div>
      </div>
    </div>
  );
}
