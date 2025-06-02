import {
  ArrowRightIcon,
  CheckIcon,
  CodeBracketIcon,
  CommandLineIcon,
  DocumentIcon,
  DocumentTextIcon,
  FolderIcon,
  FolderOpenIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
  MapIcon,
  PencilIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  ContextItemWithId,
  ToolCallDelta,
  ToolCallState,
  ToolStatus,
} from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { ComponentType, useMemo } from "react";
import { vscButtonBackground } from "../../../components";
import Spinner from "../../../components/gui/Spinner";
import { useAppSelector } from "../../../redux/hooks";
import FunctionSpecificToolCallDiv from "./FunctionSpecificToolCallDiv";
import { SimpleToolCallUI } from "./SimpleToolCallUI";
import { ToolCallDisplay } from "./ToolCall";

interface ToolCallDivProps {
  toolCall: ToolCallDelta;
  toolCallState: ToolCallState;
  output?: ContextItemWithId[];
  historyIndex: number;
}

const toolCallIcons: Record<string, ComponentType> = {
  [BuiltInToolNames.FileGlobSearch]: MagnifyingGlassIcon,
  [BuiltInToolNames.GrepSearch]: CommandLineIcon,
  [BuiltInToolNames.LSTool]: FolderIcon,
  [BuiltInToolNames.ReadCurrentlyOpenFile]: DocumentTextIcon,
  [BuiltInToolNames.ReadFile]: DocumentIcon,
  [BuiltInToolNames.SearchWeb]: GlobeAltIcon,
  [BuiltInToolNames.ViewDiff]: CodeBracketIcon,
  [BuiltInToolNames.ViewRepoMap]: MapIcon,
  [BuiltInToolNames.ViewSubdirectory]: FolderOpenIcon,
  [BuiltInToolNames.CreateRuleBlock]: PencilIcon,
  // EditExistingFile = "builtin_edit_existing_file",
  // CreateNewFile = "builtin_create_new_file",
  // RunTerminalCommand = "builtin_run_terminal_command",
};

function getStatusIcon(state: ToolStatus) {
  switch (state) {
    case "generating":
    case "calling":
      return <Spinner />;
    case "generated":
      return <ArrowRightIcon color={vscButtonBackground} />;
    case "done":
      return <CheckIcon className="text-green-500" />;
    case "canceled":
    case "errored":
      return <XMarkIcon className="text-red-500" />;
  }
}

export function ToolCallDiv(props: ToolCallDivProps) {
  const availableTools = useAppSelector((state) => state.config.config.tools);
  const tool = useMemo(() => {
    return availableTools.find(
      (tool) => props.toolCall.function?.name === tool.function.name,
    );
  }, [availableTools, props.toolCall]);

  const icon =
    props.toolCall.function?.name &&
    toolCallIcons[props.toolCall.function.name];

  if (icon) {
    return (
      <SimpleToolCallUI
        tool={tool}
        toolCallState={props.toolCallState}
        icon={
          props.toolCallState.status === "generated" ? ArrowRightIcon : icon
        }
        contextItems={props.output ?? []}
      />
    );
  }

  return (
    <ToolCallDisplay
      icon={getStatusIcon(props.toolCallState.status)}
      tool={tool}
      toolCallState={props.toolCallState}
    >
      <FunctionSpecificToolCallDiv
        toolCall={props.toolCall}
        toolCallState={props.toolCallState}
        historyIndex={props.historyIndex}
      />
    </ToolCallDisplay>
  );
}
