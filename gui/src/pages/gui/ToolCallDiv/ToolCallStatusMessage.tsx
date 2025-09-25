import { Tool, ToolCallState } from "core";
import Mustache from "mustache";
import { useContext } from "react";
import { openContextItem } from "../../../components/mainInput/belowMainInput/ContextItemsPeek";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { getStatusIntro, toolCallStateToContextItems } from "./utils";

interface ToolCallStatusMessageProps {
  tool: Tool | undefined;
  toolCallState: ToolCallState;
}

export function ToolCallStatusMessage({
  tool,
  toolCallState,
}: ToolCallStatusMessageProps) {
  const ideMessenger = useContext(IdeMessengerContext);

  function handleClick() {
    if (contextItems.length > 0) {
      openContextItem(contextItems[0], ideMessenger);
    }
  }

  if (!tool) return "Agent tool use";

  const toolName = tool.displayTitle ?? tool.function.name;
  const defaultToolDescription = `${toolName} tool`;

  const futureMessage: string = tool.wouldLikeTo
    ? Mustache.render(tool.wouldLikeTo, toolCallState.parsedArgs)
    : `use the ${defaultToolDescription}`;
  // TODO go back and replace arg string values and tool names with <code> tags
  // to make them more readable

  let intro = getStatusIntro(toolCallState.status, tool.isInstant);
  let message = "";

  // Handle the special case for "done" status or instant tools that are calling
  if (
    toolCallState.status === "done" ||
    (tool.isInstant && toolCallState.status === "calling")
  ) {
    message = tool.hasAlready
      ? Mustache.render(tool.hasAlready, toolCallState.parsedArgs)
      : `used the ${defaultToolDescription}`;
  } else {
    switch (toolCallState.status) {
      case "generating":
      case "generated":
      case "canceled":
      case "errored":
        message = futureMessage;
        break;
      case "calling":
        message = tool.isCurrently
          ? Mustache.render(tool.isCurrently, toolCallState.parsedArgs)
          : `calling the ${defaultToolDescription}`;
        break;
      default:
        message = defaultToolDescription;
    }
  }

  const contextItems = toolCallStateToContextItems(toolCallState);
  const isClickable = contextItems.length > 0;

  return (
    <div
      className={`text-description line-clamp-4 min-w-0 break-all transition-colors duration-200 ease-in-out ${
        isClickable ? "cursor-pointer hover:brightness-125" : ""
      }`}
      data-testid="tool-call-title"
      onClick={isClickable ? handleClick : undefined}
    >
      {`Continue ${intro} ${message}`}
    </div>
  );
}
