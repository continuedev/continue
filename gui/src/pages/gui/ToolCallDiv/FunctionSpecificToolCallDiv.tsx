import { ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { CreateFile } from "./CreateFile";
import { EditFile } from "./EditFile";
import { RunTerminalCommand } from "./RunTerminalCommand";

function FunctionSpecificToolCallDiv({
  toolCallState,
  historyIndex,
}: {
  toolCallState: ToolCallState;
  historyIndex: number;
}) {
  const args = toolCallState.parsedArgs;
  const toolCall = toolCallState.toolCall;

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
    default:
      return null;
  }
}

export default FunctionSpecificToolCallDiv;
