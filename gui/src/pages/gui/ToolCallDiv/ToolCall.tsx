import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { ToolCallDelta, ToolCallState } from "core";
import Mustache from "mustache";
import { ReactNode, useMemo, useState } from "react";
import { ToolTip } from "../../../components/gui/Tooltip";
import { useAppSelector } from "../../../redux/hooks";

interface ToolCallDisplayProps {
  children: React.ReactNode;
  icon: React.ReactNode;
  toolCall: ToolCallDelta;
  toolCallState: ToolCallState;
}

export function ToolCallDisplay(props: ToolCallDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const availableTools = useAppSelector((state) => state.config.config.tools);

  const tool = useMemo(() => {
    return availableTools.find(
      (tool) => props.toolCall.function?.name === tool.function.name,
    );
  }, [availableTools, props.toolCall]);

  const statusMessage = useMemo(() => {
    if (!tool) return "Agent tool use";

    const defaultToolDescription = (
      <>
        <code>{tool.displayTitle ?? tool.function.name}</code> <span>tool</span>
      </>
    );

    const futureMessage = tool.wouldLikeTo ? (
      Mustache.render(tool.wouldLikeTo, props.toolCallState.parsedArgs)
    ) : (
      <>
        <span>use the</span> {defaultToolDescription}
      </>
    );

    let intro = "";
    let message: ReactNode = "";

    if (props.toolCallState.status === "generating") {
      intro = "is generating output to";
      message = futureMessage;
    } else if (props.toolCallState.status === "generated") {
      intro = "wants to";
      message = futureMessage;
    } else if (props.toolCallState.status === "calling") {
      intro = "is";
      message = tool.isCurrently ? (
        Mustache.render(tool.isCurrently, props.toolCallState.parsedArgs)
      ) : (
        <>
          <span>calling the</span> {defaultToolDescription}
        </>
      );
    } else if (props.toolCallState.status === "done") {
      intro = "";
      message = tool.hasAlready ? (
        Mustache.render(tool.hasAlready, props.toolCallState.parsedArgs)
      ) : (
        <>
          <span>used the</span> {defaultToolDescription}
        </>
      );
    } else if (props.toolCallState.status === "canceled") {
      intro = "tried to";
      message = futureMessage;
    }
    return (
      <div className="block">
        <span>Continue</span> {intro} {message}
      </div>
    );
  }, [props.toolCallState, tool]);

  const args: [string, any][] = useMemo(() => {
    return Object.entries(props.toolCallState.parsedArgs);
  }, [props.toolCallState.parsedArgs]);

  const argsTooltipId = useMemo(() => {
    return "args-hover-" + props.toolCallState.toolCallId;
  }, [props.toolCallState]);

  return (
    <>
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
                {props.icon}
              </div>
              {tool?.faviconUrl && (
                <img src={tool.faviconUrl} className="h-4 w-4 rounded-sm" />
              )}
              <div className="flex">{statusMessage}</div>
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
        <div>{props.children}</div>
      </div>
    </>
  );
}
