import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { ToolCallDelta, ToolCallState } from "core";
import Mustache from "mustache";
import { useMemo, useState } from "react";
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

  const wouldLikeToMessage = useMemo(() => {
    if (!tool) return "";

    const rendered = Mustache.render(
      tool.wouldLikeTo,
      props.toolCallState.parsedArgs,
    );
    return rendered;
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
              <div className="">
                Continue wants to <span>{wouldLikeToMessage.trim()}</span>
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
            <div className="ml-7">
              {args.map(([key, value]) => (
                <div key={key} className="flex gap-2 py-1">
                  <span className="text-lightgray">{key}:</span>
                  <code className="lines lines-1">{value}</code>
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
