import {
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
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
import { ContextItemWithId, Tool, ToolCallDelta, ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import Mustache from "mustache";
import { ComponentType, ReactNode, useMemo, useState } from "react";
import { vscButtonBackground } from "../../../components";
import Spinner from "../../../components/gui/Spinner";
import { ToolTip } from "../../../components/gui/Tooltip";
import { ContextItemsPeekItem } from "../../../components/mainInput/belowMainInput/ContextItemsPeek";
import { useAppSelector } from "../../../redux/hooks";
import { CreateFile } from "./CreateFile";
import { EditFile } from "./EditFile";
import { RunTerminalCommand } from "./RunTerminalCommand";
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

export function getToolCallStatusMessage(
  tool: Tool | undefined,
  toolCallState: ToolCallState,
) {
  if (!tool) return "Agent tool use";

  const defaultToolDescription = (
    <>
      <code>{tool.displayTitle ?? tool.function.name}</code> <span>tool</span>
    </>
  );

  const futureMessage = tool.wouldLikeTo ? (
    Mustache.render(tool.wouldLikeTo, toolCallState.parsedArgs)
  ) : (
    <>
      <span>use the</span> {defaultToolDescription}
    </>
  );

  let intro = "";
  let message: ReactNode = "";

  if (
    toolCallState.status === "done" ||
    (tool.isInstant && toolCallState.status === "calling")
  ) {
    intro = "";
    message = tool.hasAlready ? (
      Mustache.render(tool.hasAlready, toolCallState.parsedArgs)
    ) : (
      <>
        <span>used the</span> {defaultToolDescription}
      </>
    );
  } else if (toolCallState.status === "generating") {
    intro = "is generating output to";
    message = futureMessage;
  } else if (toolCallState.status === "generated") {
    intro = "wants to";
    message = futureMessage;
  } else if (toolCallState.status === "calling") {
    intro = "is";
    message = tool.isCurrently ? (
      Mustache.render(tool.isCurrently, toolCallState.parsedArgs)
    ) : (
      <>
        <span>calling the</span> {defaultToolDescription}
      </>
    );
  } else if (toolCallState.status === "canceled") {
    intro = "tried to";
    message = futureMessage;
  }
  return (
    <div className="block">
      <span>Continue</span> {intro} {message}
    </div>
  );
}

export function ToolCallDiv(props: ToolCallDivProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const args: [string, any][] = useMemo(() => {
    return Object.entries(props.toolCallState.parsedArgs);
  }, [props.toolCallState.parsedArgs]);

  const argsTooltipId = useMemo(() => {
    return "args-hover-" + props.toolCallState.toolCallId;
  }, [props.toolCallState]);

  const availableTools = useAppSelector((store) => store.config.config.tools);
  const tool = useMemo(() => {
    return availableTools.find(
      (tool) => props.toolCall.function?.name === tool.function.name,
    );
  }, [availableTools, props.toolCall]);

  const statusMessage = useMemo(() => {
    return getToolCallStatusMessage(tool, props.toolCallState);
  }, [props.toolCallState, tool]);

  const icon = useMemo(() => {
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
            <div
              style={{
                width: `16px`,
                height: `16px`,
                fontWeight: "bolder",
                marginTop: "1px",
                flexShrink: 0,
              }}
            >
              {icon}
            </div>
            {tool?.faviconUrl && (
              <img src={tool.faviconUrl} className="h-4 w-4 rounded-sm" />
            )}
            <div className="flex" data-testid="tool-call-status-message">
              {statusMessage}
            </div>
          </div>
          {!!args.length ? (
            <div
              data-tooltip-id={argsTooltipId}
              onClick={() => setIsExpanded(!isExpanded)}
              className="ml-2 cursor-pointer hover:opacity-80"
            >
              {isExpanded ? (
                <ChevronUpIcon className="h-4 w-4" />
              ) : (
                <ChevronDownIcon className="h-4 w-4" />
              )}
            </div>
          ) : null}
          <ToolTip id={argsTooltipId}>
            {isExpanded ? "Hide args" : "Show args"}
          </ToolTip>
        </div>

        {isExpanded && !!args.length && (
          <div className="ml-7 mt-1">
            {args.map(([key, value]) => (
              <div key={key} className="flex gap-2 py-0.5">
                <span className="text-lightgray">{key}:</span>
                <code className="line-clamp-1">{value.toString()}</code>
              </div>
            ))}
          </div>
        )}
      </div>
      {functionSpecificDiv}
    </div>
  );
}
