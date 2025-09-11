import { Tool, ToolCallState } from "core";
import { useMemo, useState } from "react";
import { ArgsItems, ArgsToggleIcon } from "./ToolCallArgs";
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
  tool,
  toolCallState,
  children,
  icon,
  historyIndex,
}: ToolCallDisplayProps) {
  const [argsExpanded, setArgsExpanded] = useState(false);

  const args: [string, any][] = useMemo(() => {
    return Object.entries(toolCallState.parsedArgs);
  }, [toolCallState.parsedArgs]);

  return (
    <div className="flex flex-col justify-center px-4">
      <div className="mb-2 flex flex-col">
        <div className="flex flex-row items-center justify-between gap-1.5">
          <div className="flex min-w-0 flex-row items-center gap-2">
            <div className="mt-[1px] h-4 w-4 flex-shrink-0 font-semibold">
              {icon}
            </div>
            {tool?.faviconUrl && (
              <img src={tool.faviconUrl} className="h-4 w-4 rounded-sm" />
            )}
            <ToolCallStatusMessage tool={tool} toolCallState={toolCallState} />
          </div>
          <div className="flex flex-row items-center gap-1.5">
            {!!toolCallState.output && (
              <ToolTruncateHistoryIcon historyIndex={historyIndex} />
            )}
            {!!args.length ? (
              <ArgsToggleIcon
                isShowing={argsExpanded}
                setIsShowing={setArgsExpanded}
              />
            ) : null}
          </div>
        </div>
        {argsExpanded && !!args.length && (
          <ArgsItems args={args} isShowing={argsExpanded} />
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}
