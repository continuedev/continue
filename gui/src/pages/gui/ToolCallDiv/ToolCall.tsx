import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { Tool, ToolCallState } from "core";
import { useMemo, useState } from "react";
import { ToolTip } from "../../../components/gui/Tooltip";
import { ToolCallStatusMessage } from "./ToolCallStatusMessage";

interface ToolCallDisplayProps {
  children: React.ReactNode;
  icon: React.ReactNode;
  tool: Tool | undefined;
  toolCallState: ToolCallState;
}

export function ToolCallDisplay({
  tool,
  toolCallState,
  children,
  icon,
}: ToolCallDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const args: [string, any][] = useMemo(() => {
    return Object.entries(toolCallState.parsedArgs);
  }, [toolCallState.parsedArgs]);

  const argsTooltipId = useMemo(() => {
    return "args-hover-" + toolCallState.toolCallId;
  }, [toolCallState]);

  return (
    <>
      <div className="relative flex flex-col justify-center p-4 pb-0">
        <div className="mb-4 flex flex-col">
          <div className="flex flex-row items-center justify-between gap-3">
            <div className="flex flex-row gap-2">
              <div className="mt-[1px] h-4 w-4 flex-shrink-0 font-semibold">
                {icon}
              </div>
              {tool?.faviconUrl && (
                <img src={tool.faviconUrl} className="h-4 w-4 rounded-sm" />
              )}
              <div className="flex" data-testid="tool-call-status-message">
                <ToolCallStatusMessage
                  tool={tool}
                  toolCallState={toolCallState}
                />
              </div>
            </div>
            {!!args.length ? (
              <div
                data-tooltip-id={argsTooltipId}
                onClick={() => setIsExpanded(!isExpanded)}
                className="ml-2 cursor-pointer hover:opacity-80"
              >
                {isExpanded ? (
                  <ChevronUpIcon className="h-4 w-4" />
                ) : (
                  <ChevronDownIcon className="h-4 w-4" />
                )}
              </div>
            ) : null}
            <ToolTip id={argsTooltipId}>
              {isExpanded ? "Hide args" : "Show args"}
            </ToolTip>
          </div>

          {isExpanded && !!args.length && (
            <div className="ml-7 mt-1">
              {args.map(([key, value]) => (
                <div key={key} className="flex gap-2 py-0.5">
                  <span className="text-lightgray">{key}:</span>
                  <code className="line-clamp-1">{value.toString()}</code>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>{children}</div>
      </div>
    </>
  );
}
