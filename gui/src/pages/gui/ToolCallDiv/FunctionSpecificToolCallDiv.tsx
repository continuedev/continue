import { ToolCall, ToolCallState } from "core";
import { CreateFile } from "./CreateFile";
import { RunTerminalCommand } from "./RunTerminalCommand";

function FunctionSpecificToolCallDiv({
  toolCall,
  toolCallState,
}: {
  toolCall: ToolCall;
  toolCallState: ToolCallState;
}) {
  const args = toolCallState.parsedArgs;

  switch (toolCall.function.name) {
    case "create_new_file":
      return (
        <CreateFile filepath={args.filepath} fileContents={args.contents} />
      );
    case "run_terminal_command":
      return (
        <RunTerminalCommand
          command={args.command}
          toolCallState={toolCallState}
        />
      );
    default:
      return null;
  }
}

export default FunctionSpecificToolCallDiv;
