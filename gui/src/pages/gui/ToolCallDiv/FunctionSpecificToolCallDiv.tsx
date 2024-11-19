import { ToolCall } from "core";
import { incrementalParseJson } from "core/util/incrementalParseJson";
import { CreateFile } from "./CreateFile";
import { RunTerminalCommand } from "./RunTerminalCommand";
import { ToolState } from "./types";

function FunctionSpecificToolCallDiv({
  toolCall,
  state,
}: {
  toolCall: ToolCall;
  state: ToolState;
}) {
  const [_, args] = incrementalParseJson(toolCall.function.arguments);

  switch (toolCall.function.name) {
    case "create_new_file":
      return (
        <CreateFile
          filepath={args.filepath}
          fileContents={args.contents}
          state={state}
        />
      );
    case "run_terminal_command":
      return <RunTerminalCommand command={args.command} state={state} />;
    default:
      return (
        <>
          <div>{toolCall.function.name}</div>
          {Object.entries(args)?.map(([key, value]) => (
            <div key={key}>
              {key}: {JSON.stringify(value)}
            </div>
          ))}
        </>
      );
  }
}

export default FunctionSpecificToolCallDiv;
