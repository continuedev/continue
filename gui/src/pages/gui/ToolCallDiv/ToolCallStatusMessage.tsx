import { Tool, ToolCallState } from "core";
import Mustache from "mustache";
import { ReactNode } from "react";

interface ToolCallStatusMessageProps {
  tool: Tool | undefined;
  toolCallState: ToolCallState;
}

export function ToolCallStatusMessage({
  tool,
  toolCallState,
}: ToolCallStatusMessageProps) {
  if (!tool) return "Agent tool use";

  const defaultToolDescription = (
    <>
      <code>{tool.displayTitle ?? tool.function.name}</code> <span>tool</span>
    </>
  );

  const futureMessage = tool.wouldLikeTo ? (
    Mustache.render(tool.wouldLikeTo, toolCallState.parsedArgs)
  ) : (
    <>
      <span>use the</span> {defaultToolDescription}
    </>
  );

  let intro = "";
  let message: ReactNode = "";

  if (
    toolCallState.status === "done" ||
    (tool.isInstant && toolCallState.status === "calling")
  ) {
    intro = "";
    message = tool.hasAlready ? (
      Mustache.render(tool.hasAlready, toolCallState.parsedArgs)
    ) : (
      <>
        <span>used the</span> {defaultToolDescription}
      </>
    );
  } else if (toolCallState.status === "generating") {
    intro = "is generating output to";
    message = futureMessage;
  } else if (toolCallState.status === "generated") {
    intro = "wants to";
    message = futureMessage;
  } else if (toolCallState.status === "calling") {
    intro = "is";
    message = tool.isCurrently ? (
      Mustache.render(tool.isCurrently, toolCallState.parsedArgs)
    ) : (
      <>
        <span>calling the</span> {defaultToolDescription}
      </>
    );
  } else if (
    toolCallState.status === "canceled" ||
    toolCallState.status === "errored"
  ) {
    intro = "tried to";
    message = futureMessage;
  }
  return (
    <div className="block">
      <span>Continue</span> {intro} {message}
    </div>
  );
}
