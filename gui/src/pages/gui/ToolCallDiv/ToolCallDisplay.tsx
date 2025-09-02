import { Tool, ToolCallState } from "core";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { renderContextItems } from "core/util/messageContent";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
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
  const ideMessenger = useContext(IdeMessengerContext);
  const [argsExpanded, setArgsExpanded] = useState(false);
  const hasAutoOpenedError = useRef(false);

  const args: [string, any][] = useMemo(() => {
    return Object.entries(toolCallState.parsedArgs);
  }, [toolCallState.parsedArgs]);

  // Auto-open error details when tool call fails
  useEffect(() => {
    if (
      toolCallState.status === "errored" &&
      toolCallState.output &&
      toolCallState.output.length > 0 &&
      !hasAutoOpenedError.current
    ) {
      hasAutoOpenedError.current = true;
      ideMessenger.post("showVirtualFile", {
        name: "Tool Call Error",
        content: renderContextItems(toolCallState.output),
      });
    }
  }, [toolCallState.status, toolCallState.output, ideMessenger]);

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
