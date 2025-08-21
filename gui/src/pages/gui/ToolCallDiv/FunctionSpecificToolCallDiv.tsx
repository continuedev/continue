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
          relativeFilepath={args?.filepath ?? ""}
          fileContents={args?.contents ?? ""}
          historyIndex={historyIndex}
        />
      );
    case BuiltInToolNames.EditExistingFile:
      return (
        <EditFile
          relativeFilePath={args?.filepath ?? ""}
          changes={args?.changes ?? ""}
          toolCallId={toolCall.id}
          historyIndex={historyIndex}
        />
      );
    case BuiltInToolNames.SearchAndReplaceInFile:
      const changes = args.diffs
        ? Array.isArray(args.diffs)
          ? args.diffs.join("\n\n---\n\n")
          : args.diffs
        : "";

      return (
        <EditFile
          showToolCallStatusIcon={true}
          status={toolCallState.status}
          relativeFilePath={args?.filepath ?? ""}
          changes={changes}
          toolCallId={toolCall.id}
          historyIndex={historyIndex}
        />
      );
    case BuiltInToolNames.SingleFindAndReplace:
      const fakeSearchReplaceBlock = `===== SEARCH
${args?.old_string ?? ""}
=====
${args?.new_string ?? ""}
===== REPLACE`;

      return (
        <EditFile
          showToolCallStatusIcon={true}
          status={toolCallState.status}
          relativeFilePath={args?.filepath ?? ""}
          changes={fakeSearchReplaceBlock}
          toolCallId={toolCall.id}
          historyIndex={historyIndex}
        />
      );
    case BuiltInToolNames.MultiEdit:
      const fakeSearchReplaceBlocks =
        (args?.edits as { old_string: string; new_string: string }[])
          ?.map(
            (edit) => `===== SEARCH
${edit?.old_string ?? ""}
=====
${edit?.new_string ?? ""}
===== REPLACE`,
          )
          .join("\n\n---\n\n") ?? "";

      return (
        <EditFile
          showToolCallStatusIcon={true}
          status={toolCallState.status}
          relativeFilePath={args?.filepath ?? ""}
          changes={fakeSearchReplaceBlocks}
          toolCallId={toolCall.id}
          historyIndex={historyIndex}
        />
      );
    case BuiltInToolNames.RunTerminalCommand:
      return (
        <RunTerminalCommand
          command={args?.command ?? ""}
          toolCallState={toolCallState}
          toolCallId={toolCall.id}
        />
      );
    default:
      return null;
  }
}

export default FunctionSpecificToolCallDiv;
