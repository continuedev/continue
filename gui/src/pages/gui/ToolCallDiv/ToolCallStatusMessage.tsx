import { Tool, ToolCallState } from "core";
import Mustache from "mustache";
import { getStatusIntro } from "./utils";
import { useTranslation } from "react-i18next";

interface ToolCallStatusMessageProps {
  tool: Tool | undefined;
  toolCallState: ToolCallState;
}

export function ToolCallStatusMessage({
  tool,
  toolCallState,
}: ToolCallStatusMessageProps) {
  const { t } = useTranslation();
  // Helper function to translate tool names, falling back to the original name if translation is missing.
  const t_tool = function (name: string) {
    const key = "ToolCallStatusMessage.tool." + name;
    const val = t(key);
    if (key === val) {
      return name;
    }
    return val;
  };

  if (!tool) return t("ToolCallStatusMessage.AgentToolUse");

  const toolName = tool.displayTitle ?? tool.function.name;
  const defaultToolDescription = t("ToolCallStatusMessage.ToolNameTool", {
    toolName,
  });

  const futureMessage: string = tool.wouldLikeTo
    ? Mustache.render(t_tool(tool.wouldLikeTo), toolCallState.parsedArgs)
    : t("ToolCallStatusMessage.UseThe", { defaultToolDescription });
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
      ? Mustache.render(t_tool(tool.hasAlready), toolCallState.parsedArgs)
      : t("ToolCallStatusMessage.UsedThe", { defaultToolDescription });
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
          ? Mustache.render(t_tool(tool.isCurrently), toolCallState.parsedArgs)
          : t("ToolCallStatusMessage.CallingThe", { defaultToolDescription });
        break;
      default:
        message = defaultToolDescription;
    }
  }

  return (
    <div
      className="text-description line-clamp-4 min-w-0 break-words"
      data-testid="tool-call-title"
    >
      {t("ToolCallStatusMessage.ContinueIntroMessage", { intro, message })}
    </div>
  );
}
