import { ToolCall } from "core";
import { incrementalParseJson } from "core/util/incrementalParseJson";
import { CreateFile } from "./CreateFile";
import { RunTerminalCommand } from "./RunTerminalCommand";

function FunctionSpecificToolCallDiv({ toolCall }: { toolCall: ToolCall }) {
  const [_, args] = incrementalParseJson(toolCall.function.arguments);

  switch (toolCall.function.name) {
    case "create_new_file":
      return (
        <CreateFile filepath={args.filepath} fileContents={args.contents} />
      );
    case "run_terminal_command":
      return <RunTerminalCommand command={args.command} />;
    default:
      return null;
  }
}

export default FunctionSpecificToolCallDiv;
