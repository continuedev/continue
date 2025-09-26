import { Tool, ToolCallState } from "core";
import { useContext, useMemo } from "react";
import { openContextItem } from "../../../components/mainInput/belowMainInput/ContextItemsPeek";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { ToolCallStatusMessage } from "./ToolCallStatusMessage";
import { toolCallStateToContextItems } from "./utils";
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
  const shownContextItems = useMemo(() => {
    const contextItems = toolCallStateToContextItems(toolCallState);
    return contextItems.filter((item) => !item.hidden);
  }, [toolCallState]);

  const isClickable = shownContextItems.length > 0;

  function handleClick() {
    if (shownContextItems.length > 0) {
      openContextItem(shownContextItems[0], ideMessenger);
    }
  }
  return (
    <div className="flex flex-col justify-center px-4">
      <div className="mb-2 flex flex-col">
        <div className="flex flex-row items-start justify-between gap-1.5">
          <div
            className={`flex min-w-0 flex-row items-center gap-2 transition-colors duration-200 ease-in-out ${
              isClickable ? "cursor-pointer hover:brightness-125" : ""
            }`}
            onClick={isClickable ? handleClick : undefined}
          >
            <div className="mt-[1px] h-4 w-4 flex-shrink-0 font-semibold">
              {icon}
            </div>
            {tool?.faviconUrl && (
              <img src={tool.faviconUrl} className="h-4 w-4 rounded-sm" />
            )}
            <ToolCallStatusMessage tool={tool} toolCallState={toolCallState} />
          </div>
          {!!toolCallState.output?.length && (
            <ToolTruncateHistoryIcon historyIndex={historyIndex} />
          )}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}
