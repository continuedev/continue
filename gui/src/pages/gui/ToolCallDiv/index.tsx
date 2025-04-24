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
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { ContextItemWithId, ToolCallDelta, ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { ComponentType, useMemo, useState } from "react";
import { vscButtonBackground } from "../../../components";
import Spinner from "../../../components/gui/Spinner";
import { ContextItemsPeekItem } from "../../../components/mainInput/belowMainInput/ContextItemsPeek";
import { useAppSelector } from "../../../redux/hooks";
import { ArgsItems, ArgsToggleIcon } from "./Args";
import { CreateFile } from "./CreateFile";
import { EditFile } from "./EditFile";
import { RunTerminalCommand } from "./RunTerminalCommand";
import { ToolCallStatusMessage } from "./ToolCallStatus";
interface ToolCallDivProps {
  toolCall: ToolCallDelta;
  toolCallState: ToolCallState;
  output?: ContextItemWithId[];
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

  // EditExistingFile = "builtin_edit_existing_file",
  // CreateNewFile = "builtin_create_new_file",
  // RunTerminalCommand = "builtin_run_terminal_command",
  // CreateRuleBlock = "builtin_create_rule_block",
};

export function ToolCallDiv(props: ToolCallDivProps) {
  const [argsExpanded, setArgsExpanded] = useState(false);

  const args: [string, any][] = useMemo(() => {
    return Object.entries(props.toolCallState.parsedArgs);
  }, [props.toolCallState.parsedArgs]);

  const availableTools = useAppSelector((store) => store.config.config.tools);
  const tool = useMemo(() => {
    return availableTools.find(
      (tool) => props.toolCall.function?.name === tool.function.name,
    );
  }, [availableTools, props.toolCall]);

  const statusIcon = useMemo(() => {
    switch (props.toolCallState.status) {
      case "generating":
      case "calling":
        return <Spinner />;
      case "generated":
        return <ArrowRightIcon color={vscButtonBackground} />;
      case "done":
        const DoneIcon = toolCallIcons[props.toolCall.function?.name ?? ""];
        return DoneIcon ? (
          <DoneIcon />
        ) : (
          <CheckIcon className="text-green-500" />
        );
      case "canceled":
        return <XMarkIcon className="text-red-500" />;
    }
  }, [props.toolCallState.status]);

  const toolIcon = useMemo(() => {}, []);

  const functionSpecificDiv = useMemo(() => {
    const args = props.toolCallState.parsedArgs;

    switch (props.toolCall.function?.name) {
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
            toolCallId={props.toolCall.id}
          />
        );
      case BuiltInToolNames.RunTerminalCommand:
        return (
          <RunTerminalCommand
            command={args.command}
            toolCallState={props.toolCallState}
            toolCallId={props.toolCall.id}
          />
        );
      default:
        return (
          <div className="ml-4 mt-2">
            {props.output?.map((contextItem, idx) => (
              <ContextItemsPeekItem key={idx} contextItem={contextItem} />
            ))}
          </div>
        );
    }
  }, [props.toolCall, props.toolCallState]);

  return (
    <div className="relative flex flex-col justify-center p-4 pb-0">
      <div className="mb-4 flex flex-col">
        <div className="flex flex-row items-center justify-between gap-3">
          <div className="flex flex-row gap-2">
            <div className="mt-0.5 h-4 w-4 flex-shrink-0 font-semibold">
              {statusIcon}
            </div>
            {tool?.faviconUrl && (
              <img src={tool.faviconUrl} className="h-4 w-4 rounded-sm" />
            )}
            <ToolCallStatusMessage
              tool={tool}
              toolCallState={props.toolCallState}
            />
          </div>

          {!!args.length ? (
            <ArgsToggleIcon
              isShowing={argsExpanded}
              setIsShowing={setArgsExpanded}
              toolCallId={props.toolCallState.toolCallId}
            />
          ) : null}
        </div>
        {!!args.length && <ArgsItems args={args} isShowing={argsExpanded} />}
      </div>
      {functionSpecificDiv}
    </div>
  );
}
