import {
  ArrowRightIcon,
  CheckIcon,
  CodeBracketIcon,
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
import { ToolCallDelta, ToolCallState, ToolStatus } from "core";
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
  historyIndex: number;
}

const toolCallIcons: Record<string, ComponentType> = {
  [BuiltInToolNames.FileGlobSearch]: MagnifyingGlassIcon,
  [BuiltInToolNames.GrepSearch]: MagnifyingGlassIcon,
  [BuiltInToolNames.LSTool]: FolderIcon,
  [BuiltInToolNames.ReadCurrentlyOpenFile]: DocumentTextIcon,
  [BuiltInToolNames.ReadFile]: DocumentIcon,
  [BuiltInToolNames.FetchUrlContent]: GlobeAltIcon,
  [BuiltInToolNames.SearchWeb]: GlobeAltIcon,
  [BuiltInToolNames.ViewDiff]: CodeBracketIcon,
  [BuiltInToolNames.ViewRepoMap]: MapIcon,
  [BuiltInToolNames.ViewSubdirectory]: FolderOpenIcon,
  [BuiltInToolNames.CreateRuleBlock]: PencilIcon,
  // EditExistingFile
  // CreateNewFile
  // RunTerminalCommand
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
        historyIndex={props.historyIndex}
      />
    );
  }

  // Trying this out while it's an experimental feature
  // Obviously missing the truncate and args buttons
  // All the info from args is displayed here
  // But we'd need a nicer place to put the truncate button and the X icon when tool call fails
  if (
    props.toolCall.function?.name === BuiltInToolNames.SearchAndReplaceInFile
  ) {
    return (
      <FunctionSpecificToolCallDiv
        toolCall={props.toolCall}
        toolCallState={props.toolCallState}
        historyIndex={props.historyIndex}
      />
    );
  }

  return (
    <ToolCallDisplay
      icon={getStatusIcon(props.toolCallState.status)}
      tool={tool}
      toolCallState={props.toolCallState}
      historyIndex={props.historyIndex}
    >
      <FunctionSpecificToolCallDiv
        toolCall={props.toolCall}
        toolCallState={props.toolCallState}
        historyIndex={props.historyIndex}
      />
    </ToolCallDisplay>
  );
}
