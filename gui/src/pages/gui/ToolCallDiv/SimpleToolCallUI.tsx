import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { Tool, ToolCallState } from "core";
import { ComponentType, useMemo, useState } from "react";
import { ContextItemsPeekItem } from "../../../components/mainInput/belowMainInput/ContextItemsPeek";
import { ArgsItems, ArgsToggleIcon } from "./ToolCallArgs";
import { toolCallStateToContextItems } from "./toolCallStateToContextItem";
import { ToolCallStatusMessage } from "./ToolCallStatusMessage";
import { ToolTruncateHistoryIcon } from "./ToolTruncateHistoryIcon";

interface SimpleToolCallUIProps {
  toolCallState: ToolCallState;
  tool: Tool | undefined;
  icon?: ComponentType<React.SVGProps<SVGSVGElement>>;
  historyIndex: number;
}

export function SimpleToolCallUI({
  icon: Icon,
  toolCallState,
  tool,
  historyIndex,
}: SimpleToolCallUIProps) {
  const shownContextItems = useMemo(() => {
    const contextItems = toolCallStateToContextItems(toolCallState);
    return contextItems.filter((item) => !item.hidden);
  }, [toolCallState]);

  const [open, setOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const [showingArgs, setShowingArgs] = useState(false);

  const args: [string, any][] = useMemo(() => {
    return Object.entries(toolCallState.parsedArgs);
  }, [toolCallState.parsedArgs]);

  return (
    <div className="flex flex-col pl-5 pr-2 pt-4">
      <div className="flex min-w-0 flex-row items-center justify-between gap-2">
        <div
          className="text-description flex min-w-0 cursor-pointer flex-row items-center justify-between gap-1.5 text-xs transition-colors duration-200 ease-in-out hover:brightness-125"
          onClick={() => setOpen((prev) => !prev)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          data-testid="context-items-peek"
        >
          <div className="flex h-4 w-4 flex-shrink-0 flex-col items-center justify-center">
            {Icon && !isHovered && !open ? (
              <Icon className={`text-description h-4 w-4`} />
            ) : (
              <ChevronRightIcon
                className={`text-description h-4 w-4 transition-transform duration-200 ease-in-out ${
                  open ? "rotate-90" : "rotate-0"
                }`}
              />
            )}
          </div>
          <ToolCallStatusMessage tool={tool} toolCallState={toolCallState} />
        </div>
        <div className="flex flex-row items-center gap-1.5">
          {!!toolCallState.output?.length && (
            <ToolTruncateHistoryIcon historyIndex={historyIndex} />
          )}
          {args.length > 0 ? (
            <ArgsToggleIcon
              isShowing={showingArgs}
              setIsShowing={setShowingArgs}
              toolCallId={toolCallState.toolCallId}
            />
          ) : null}
        </div>
      </div>
      <ArgsItems args={args} isShowing={showingArgs} />
      <div
        className={`mt-2 overflow-y-auto transition-all duration-300 ease-in-out ${
          open ? "max-h-[50vh] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {shownContextItems.length ? (
          shownContextItems.map((contextItem, idx) => (
            <ContextItemsPeekItem key={idx} contextItem={contextItem} />
          ))
        ) : (
          <div className="text-description pl-5 text-xs italic">
            No tool call output
          </div>
        )}
      </div>
    </div>
  );
}
