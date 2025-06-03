import { Tool, ToolCallState } from "core";
import Mustache from "mustache";
import { useFontSize } from "../../../components/ui/font";

interface ToolCallStatusMessageProps {
  tool: Tool | undefined;
  toolCallState: ToolCallState;
}

export function ToolCallStatusMessage({
  tool,
  toolCallState,
}: ToolCallStatusMessageProps) {
  const fontSize = useFontSize();
  if (!tool) return "Agent tool use";

  const toolName = tool.displayTitle ?? tool.function.name;
  const defaultToolDescription = `${toolName} tool`;

  const futureMessage: string = tool.wouldLikeTo
    ? Mustache.render(tool.wouldLikeTo, toolCallState.parsedArgs)
    : `use the ${defaultToolDescription}`;
  // TODO go back and replace arg string values and tool names with <code> tags
  // to make them more readable

  let intro = "";
  let message = "";

  if (
    toolCallState.status === "done" ||
    (tool.isInstant && toolCallState.status === "calling")
  ) {
    intro = "";
    message = tool.hasAlready
      ? Mustache.render(tool.hasAlready, toolCallState.parsedArgs)
      : `used the ${defaultToolDescription}`;
  } else if (toolCallState.status === "generating") {
    intro = "is generating output to";
    message = futureMessage;
  } else if (toolCallState.status === "generated") {
    intro = "wants to";
    message = futureMessage;
  } else if (toolCallState.status === "calling") {
    intro = "is";
    message = tool.isCurrently
      ? Mustache.render(tool.isCurrently, toolCallState.parsedArgs)
      : `calling the ${defaultToolDescription}`;
  } else if (
    toolCallState.status === "canceled" ||
    toolCallState.status === "errored"
  ) {
    intro = "tried to";
    message = futureMessage;
  }
  return (
    <div
      className="text-description line-clamp-4 min-w-0 break-words"
      style={{ fontSize }}
      data-testid="tool-call-title"
    >
      {`Continue ${intro} ${message}`}
    </div>
  );
}
