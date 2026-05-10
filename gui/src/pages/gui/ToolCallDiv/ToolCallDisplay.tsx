import { Tool, ToolCallState } from "core";
import { useContext, useMemo } from "react";
import { openContextItem } from "../../../components/mainInput/belowMainInput/ContextItemsPeek";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { ToolCallStatusMessage } from "./ToolCallStatusMessage";
import { ToolTruncateHistoryIcon } from "./ToolTruncateHistoryIcon";
import { toolCallStateToContextItems } from "./utils";

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
  const toolLabel =
    tool?.displayTitle ??
    toolCallState.toolCall.function?.name ??
    "tool result";

  function handleClick() {
    if (shownContextItems.length > 0) {
      openContextItem(shownContextItems[0], ideMessenger);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!isClickable) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClick();
    }
  }

  return (
    <div className="flex flex-col justify-center gap-1.5 px-3 py-0.5">
      <div className="flex flex-row items-start justify-between gap-1.5">
        <div
          className={`text-description flex min-w-0 flex-row items-center gap-2 text-xs transition-colors duration-200 ease-in-out ${
            isClickable ? "cursor-pointer hover:brightness-125" : ""
          }`}
          onClick={isClickable ? handleClick : undefined}
          onKeyDown={handleKeyDown}
          data-testid="tool-call-display-header"
          role={isClickable ? "button" : undefined}
          tabIndex={isClickable ? 0 : undefined}
          aria-label={isClickable ? `Open ${toolLabel}` : undefined}
        >
          <div className="mt-[1px] h-4 w-4 flex-shrink-0 font-semibold">
            {icon}
          </div>
          {tool?.faviconUrl && (
            <img src={tool.faviconUrl} alt="" className="h-4 w-4 rounded-sm" />
          )}
          <ToolCallStatusMessage tool={tool} toolCallState={toolCallState} />
        </div>
        {!!toolCallState.output?.length && (
          <ToolTruncateHistoryIcon historyIndex={historyIndex} />
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}
