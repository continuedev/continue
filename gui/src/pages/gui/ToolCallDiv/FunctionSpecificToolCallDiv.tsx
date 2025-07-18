import { ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { useAppSelector } from "../../../redux/hooks";
import { CreateFile } from "./CreateFile";
import { EditFile } from "./EditFile";
import { RunTerminalCommand } from "./RunTerminalCommand";
import { TodoCard } from "./TodoCard";

function FunctionSpecificToolCallDiv({
  toolCallState,
  historyIndex,
}: {
  toolCallState: ToolCallState;
  historyIndex: number;
}) {
  const args = toolCallState.parsedArgs;
  const toolCall = toolCallState.toolCall;
  const history = useAppSelector((state) => state.session.history);

  // Find previous markdown content by looking back through history
  const findPreviousMarkdown = (): string | undefined => {
    // Look backwards through history from current position
    for (let i = historyIndex - 1; i >= 0; i--) {
      const item = history[i];
      if (item.toolCallStates) {
        // Check each tool call state in reverse order (most recent first)
        for (let j = item.toolCallStates.length - 1; j >= 0; j--) {
          const prevToolCall = item.toolCallStates[j];
          const funcName = prevToolCall.toolCall.function?.name;

          // Look for TodoWrite calls which have markdown in args
          if (
            funcName === BuiltInToolNames.TodoWrite &&
            prevToolCall.parsedArgs?.markdown
          ) {
            return prevToolCall.parsedArgs.markdown;
          }

          // Look for TodoRead calls which have markdown in output
          if (funcName === BuiltInToolNames.TodoRead) {
            const todoItem = prevToolCall.output?.find((item) =>
              item.name?.includes("Todo List"),
            );
            if (todoItem?.content) {
              return todoItem.content;
            }
          }
        }
      }
    }
    return undefined;
  };

  switch (toolCall.function?.name) {
    case BuiltInToolNames.CreateNewFile:
      return (
        <CreateFile
          relativeFilepath={args.filepath}
          fileContents={args.contents}
          historyIndex={historyIndex}
        />
      );
    case BuiltInToolNames.EditExistingFile:
      return (
        <EditFile
          relativeFilePath={args.filepath ?? ""}
          changes={args.changes ?? ""}
          toolCallId={toolCall.id}
          historyIndex={historyIndex}
        />
      );
    case BuiltInToolNames.SearchAndReplaceInFile:
      return (
        <EditFile
          relativeFilePath={args.filepath ?? ""}
          changes={args.diffs ? args.diffs.join("\n\n---\n\n") : ""}
          toolCallId={toolCall.id}
          historyIndex={historyIndex}
        />
      );
    case BuiltInToolNames.RunTerminalCommand:
      return (
        <RunTerminalCommand
          command={args.command}
          toolCallState={toolCallState}
          toolCallId={toolCall.id}
        />
      );
    case BuiltInToolNames.TodoWrite:
      return (
        <TodoCard
          markdown={args.markdown || ""}
          previousMarkdown={findPreviousMarkdown()}
          historyIndex={historyIndex}
          toolCallId={toolCall.id}
        />
      );
    case BuiltInToolNames.TodoRead:
      // For TodoRead, the markdown is in the output content
      const todoItem = toolCallState.output?.find((item) =>
        item.name?.includes("Todo List"),
      );
      const markdown = todoItem?.content || "";
      return (
        <TodoCard
          markdown={markdown}
          previousMarkdown={findPreviousMarkdown()}
          historyIndex={historyIndex}
          toolCallId={toolCall.id}
        />
      );
    default:
      return null;
  }
}

export default FunctionSpecificToolCallDiv;
