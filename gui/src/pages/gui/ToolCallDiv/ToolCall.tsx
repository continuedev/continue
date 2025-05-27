import { ContextItemWithId, Tool, ToolCallState } from "core";
import { useMemo, useState } from "react";
import { ArgsAndOutputItems, ArgsToggleIcon } from "./ToolCallArgs";
import { ToolCallStatusMessage } from "./ToolCallStatusMessage";

interface ToolCallDisplayProps {
  children: React.ReactNode;
  icon: React.ReactNode;
  tool: Tool | undefined;
  toolCallState: ToolCallState;
  contextItems: ContextItemWithId[];
}

export function ToolCallDisplay({
  tool,
  toolCallState,
  children,
  icon,
  contextItems,
}: ToolCallDisplayProps) {
  const [argsExpanded, setArgsExpanded] = useState(false);

  const args: [string, any][] = useMemo(() => {
    return Object.entries(toolCallState.parsedArgs);
  }, [toolCallState.parsedArgs]);

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
            {!!args.length || !!contextItems.length ? (
              <ArgsToggleIcon
                isShowing={argsExpanded}
                setIsShowing={setArgsExpanded}
                toolCallId={toolCallState.toolCallId}
              />
            ) : null}
          </div>
          {argsExpanded && (
            <ArgsAndOutputItems
              args={args}
              output={contextItems}
              isShowing={argsExpanded}
            />
          )}
        </div>
        <div>{children}</div>
      </div>
    </>
  );
}
