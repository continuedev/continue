import { ToolCallDelta, ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { CreateFile } from "./CreateFile";
import { EditFile } from "./EditFile";
import { RunTerminalCommand } from "./RunTerminalCommand";

function FunctionSpecificToolCallDiv({
  toolCall,
  toolCallState,
}: {
  toolCall: ToolCallDelta;
  toolCallState: ToolCallState;
}) {
  const args = toolCallState.parsedArgs;

  switch (toolCall.function?.name) {
    case BuiltInToolNames.CreateNewFile:
      return (
        <CreateFile
          relativeFilepath={args.filepath}
          fileContents={args.contents}
        />
      );
    case BuiltInToolNames.EditExistingFile:
      return (
        <EditFile
          relativeFilePath={args.filepath}
          newContents={args.new_contents}
          toolCallId={toolCall.id}
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
