import { Tool, ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { inferResolvedUriFromRelativePath } from "core/util/ideUtils";
import Mustache from "mustache";
import { MouseEvent, useContext } from "react";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { getStatusIntro } from "./utils";

interface ToolCallStatusMessageProps {
  tool: Tool | undefined;
  toolCallState: ToolCallState;
}

function summarizeTerminalResult(
  output?: ToolCallState["output"],
): string | null {
  if (!output?.length) {
    return null;
  }

  const terminalOutput =
    output.find((item) => item.name === "Terminal")?.content ??
    output[0]?.content;

  if (!terminalOutput) {
    return null;
  }

  const lines = terminalOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  const lastLine = lines[lines.length - 1];
  const maxLength = 90;

  return lastLine.length > maxLength
    ? `${lastLine.slice(0, maxLength - 3)}...`
    : lastLine;
}

export function ToolCallStatusMessage({
  tool,
  toolCallState,
}: ToolCallStatusMessageProps) {
  const ideMessenger = useContext(IdeMessengerContext);

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

  const functionName = tool.function.name;
  const isReadAction =
    functionName === BuiltInToolNames.ReadFile ||
    functionName === BuiltInToolNames.ReadFileRange;
  const isWriteAction =
    functionName === BuiltInToolNames.CreateNewFile ||
    functionName === BuiltInToolNames.EditExistingFile ||
    functionName === BuiltInToolNames.SingleFindAndReplace ||
    functionName === BuiltInToolNames.MultiEdit ||
    functionName === BuiltInToolNames.NotebookEdit;

  const rawFilepath =
    (toolCallState.parsedArgs?.filepath as string | undefined) ??
    (toolCallState.parsedArgs?.file_path as string | undefined) ??
    (toolCallState.parsedArgs?.filePath as string | undefined);

  const filepath = rawFilepath?.trim();
  const shouldShowFileLink =
    Boolean(filepath) && (isReadAction || isWriteAction);
  const isCallingAction =
    toolCallState.status === "calling" ||
    toolCallState.status === "generating" ||
    toolCallState.status === "generated";

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

  const statusMessage =
    shouldShowFileLink && filepath
      ? message
          .replace(filepath, "")
          .replace(/\s{2,}/g, " ")
          .trim()
      : message;
  const actionText = `${intro} ${statusMessage}`.replace(/\s+/g, " ").trim();
  const terminalResultSummary =
    functionName === BuiltInToolNames.RunTerminalCommand && !isCallingAction
      ? summarizeTerminalResult(toolCallState.output)
      : null;

  async function onFileLinkClick(event: MouseEvent<HTMLSpanElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (!filepath) {
      return;
    }

    const isAbsoluteOrUri =
      filepath.startsWith("/") ||
      filepath.startsWith("file://") ||
      filepath.startsWith("~/") ||
      /^[A-Za-z]:[\\/]/.test(filepath);

    let resolvedPath = filepath;

    if (!isAbsoluteOrUri) {
      try {
        resolvedPath = await inferResolvedUriFromRelativePath(
          filepath,
          ideMessenger.ide,
        );
      } catch {
        // Fall back to the original path when resolution fails.
      }
    }

    ideMessenger.post("showFile", {
      filepath: resolvedPath,
    });
  }

  return (
    <div
      className="text-description line-clamp-4 min-w-0 break-words"
      data-testid="tool-call-title"
    >
      <span>Yuto </span>
      <span
        data-testid="tool-call-action-text"
        className={
          isCallingAction
            ? "text-link bg-[color:var(--vscode-input-background)]/60 rounded-sm px-1 font-medium"
            : ""
        }
      >
        {actionText}
      </span>
      {shouldShowFileLink && filepath && (
        <>
          {" "}
          <span
            className="text-link cursor-pointer underline decoration-dotted underline-offset-2 hover:brightness-110"
            onClick={onFileLinkClick}
            title={filepath}
          >
            {filepath}
          </span>
        </>
      )}
      {terminalResultSummary && (
        <span
          className="text-description-muted ml-1"
          data-testid="tool-call-result-summary"
        >
          {`Result: ${terminalResultSummary}`}
        </span>
      )}
    </div>
  );
}
