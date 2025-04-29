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
import { getToolCallStatusMessage, ToolCallDisplay } from "./ToolCall";
import ToolOutput from "./ToolOutput";

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
};

export function ToolCallDiv(props: ToolCallDivProps) {
  function getIcon(state: ToolStatus) {
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

  const availableTools = useAppSelector((state) => state.config.config.tools);
  const tool = useMemo(() => {
    return availableTools.find(
      (tool) => props.toolCall.function?.name === tool.function.name,
    );
  }, [availableTools, props.toolCall]);

  const statusMessage = useMemo(() => {
    return getToolCallStatusMessage(tool, props.toolCallState);
  }, [props.toolCallState, tool]);

  const icon =
    props.toolCall.function?.name &&
    toolCallIcons[props.toolCall.function?.name];

  if (icon && props.toolCall.id) {
    return (
      <div className="ml-4 mt-2">
        <ToolOutput
          title={statusMessage}
          icon={
            props.toolCallState.status === "generated" ? ArrowRightIcon : icon
          }
          contextItems={props.output ?? []}
          toolCallId={props.toolCall.id}
        />
      </div>
    );
  }

  return (
    <ToolCallDisplay
      icon={getIcon(props.toolCallState.status)}
      toolCall={props.toolCall}
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
