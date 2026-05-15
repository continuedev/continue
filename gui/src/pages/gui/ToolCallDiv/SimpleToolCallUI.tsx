import {
  ChevronDownIcon,
  ChevronUpIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { Tool, ToolCallState } from "core";
import {
  ComponentType,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ContextItemsPeekItem,
  openContextItem,
} from "../../../components/mainInput/belowMainInput/ContextItemsPeek";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { ToolCallStatusMessage } from "./ToolCallStatusMessage";
import { ToolTruncateHistoryIcon } from "./ToolTruncateHistoryIcon";
import { toolCallStateToContextItems } from "./utils";

function getStatusIconClass(status: ToolCallState["status"]): string {
  switch (status) {
    case "calling":
    case "generating":
      return "text-[color:var(--vscode-progressBar-background)]";
    case "done":
      return "text-[color:var(--vscode-testing-iconPassed)]";
    case "generated":
      return "text-[color:var(--vscode-textLink-foreground)]";
    case "errored":
    case "canceled":
      return "text-[color:var(--vscode-testing-iconFailed)]";
    default:
      return "text-description";
  }
}

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
  const ideMessenger = useContext(IdeMessengerContext);
  const shownContextItems = useMemo(() => {
    const contextItems = toolCallStateToContextItems(toolCallState);
    return contextItems.filter((item) => !item.hidden);
  }, [toolCallState]);

  const isActive =
    toolCallState.status === "calling" || toolCallState.status === "generating";

  const isToggleable = shownContextItems.length > 1;
  const isSingleItem = shownContextItems.length === 1;
  const isClickable = isToggleable || isSingleItem;
  const toolLabel =
    tool?.displayTitle ??
    toolCallState.toolCall.function?.name ??
    "tool result";
  const bodyId = `simple-tool-call-body-${toolCallState.toolCallId ?? historyIndex}`;

  const [open, setOpen] = useState(isActive);
  const prevIsActive = useRef(isActive);

  // Auto-open while active, collapse when done (mirrors ThinkingBlockPeek)
  useEffect(() => {
    if (isActive) {
      setOpen(true);
    } else if (prevIsActive.current) {
      setOpen(false);
    }
    prevIsActive.current = isActive;
  }, [isActive]);

  const DisplayIcon = Icon ?? WrenchScrewdriverIcon;

  function handleClick() {
    if (isToggleable) {
      setOpen((prev) => !prev);
    } else if (isSingleItem) {
      openContextItem(shownContextItems[0], ideMessenger);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (!isClickable) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClick();
    }
  }

  return (
    <div className="mt-1 flex flex-col px-4">
      <div className="flex min-w-0 flex-row items-center justify-between gap-2">
        <div
          className={`text-description flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors duration-200 ease-in-out ${
            isClickable
              ? "hover:bg-[color:var(--vscode-input-background)]/40 cursor-pointer"
              : "cursor-default"
          }`}
          onClick={isClickable ? handleClick : undefined}
          onKeyDown={handleKeyDown}
          data-testid="context-items-peek"
          role={isClickable ? "button" : undefined}
          tabIndex={isClickable ? 0 : undefined}
          aria-expanded={isToggleable ? open : undefined}
          aria-controls={isToggleable ? bodyId : undefined}
          aria-label={
            isToggleable
              ? `Toggle ${toolLabel} results`
              : isSingleItem
                ? `Open ${toolLabel} result`
                : undefined
          }
        >
          <span className="mt-[1px] flex h-4 w-4 flex-shrink-0 items-center justify-center">
            <DisplayIcon
              className={`h-4 w-4 ${getStatusIconClass(toolCallState.status)} ${
                isActive ? "animate-pulse" : ""
              }`}
            />
          </span>

          <span className="min-w-0 flex-1">
            <ToolCallStatusMessage tool={tool} toolCallState={toolCallState} />
          </span>

          {isToggleable && (
            <span
              data-testid="simple-tool-call-toggle"
              className="flex-shrink-0 opacity-60"
            >
              {open ? (
                <ChevronUpIcon className="h-3.5 w-3.5" />
              ) : (
                <ChevronDownIcon className="h-3.5 w-3.5" />
              )}
            </span>
          )}
        </div>

        {!!toolCallState.output?.length && (
          <ToolTruncateHistoryIcon historyIndex={historyIndex} />
        )}
      </div>

      {/* Collapsible body */}
      {isToggleable && (
        <div
          id={bodyId}
          data-testid="simple-tool-call-body"
          className={`transition-all duration-200 ease-in-out ${
            open
              ? "max-h-[50vh] opacity-100"
              : "max-h-0 overflow-hidden opacity-0"
          }`}
        >
          <div className="thin-scrollbar max-h-[50vh] overflow-y-auto pb-1 pl-5 pr-1 pt-1">
            {shownContextItems.map((contextItem, idx) => (
              <ContextItemsPeekItem key={idx} contextItem={contextItem} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
