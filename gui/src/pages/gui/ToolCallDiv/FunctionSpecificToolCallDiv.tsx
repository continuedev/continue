import { ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { EditOperation } from "core/tools/definitions/multiEdit";
import { CreateFile } from "./CreateFile";
import { EditFile } from "./EditFile";
import { FindAndReplaceDisplay } from "./FindAndReplace";
import { RunTerminalCommand } from "./RunTerminalCommand";

function FunctionSpecificToolCallDiv({
  toolCallState,
  historyIndex,
}: {
  toolCallState: ToolCallState;
  historyIndex: number;
}) {
  const args = toolCallState.parsedArgs;
  const processedArgs = toolCallState.processedArgs;
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
          relativeFilePath={processedArgs?.filepath ?? args?.filepath ?? ""}
          changes={processedArgs?.changes ?? args?.changes ?? ""}
          toolCallId={toolCall.id}
          historyIndex={historyIndex}
        />
      );
    case BuiltInToolNames.SingleFindAndReplace:
      const edits: EditOperation[] = [
        {
          old_string: processedArgs?.old_string ?? args?.old_string ?? "",
          new_string: processedArgs?.new_string ?? args?.new_string ?? "",
          replace_all: processedArgs?.replace_all ?? args?.replace_all,
        },
      ];
      return (
        <FindAndReplaceDisplay
          editingFileContents={processedArgs?.editingFileContents}
          fileUri={processedArgs?.fileUri ?? ""}
          newFileContents={processedArgs?.newFileContents}
          relativeFilePath={processedArgs?.filepath ?? args?.filepath ?? ""}
          edits={edits}
          toolCallId={toolCall.id}
          historyIndex={historyIndex}
        />
      );
    case BuiltInToolNames.MultiEdit:
      return (
        <FindAndReplaceDisplay
          editingFileContents={processedArgs?.editingFileContents}
          relativeFilePath={processedArgs?.filepath ?? args?.filepath ?? ""}
          fileUri={processedArgs?.fileUri ?? ""}
          newFileContents={processedArgs?.newFileContents}
          edits={processedArgs?.edits ?? args?.edits ?? []}
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
