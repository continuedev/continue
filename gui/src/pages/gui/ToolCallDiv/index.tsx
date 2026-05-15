import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppSelector } from "../../../redux/hooks";
import { RootState } from "../../../redux/store";
import { isCoordinationSummaryTool } from "./CoordinationToolCallSummary";
import FunctionSpecificToolCallDiv from "./FunctionSpecificToolCallDiv";
import {
  getReviewBatchSummary,
  GroupedToolCallHeader,
} from "./GroupedToolCallHeader";
import { McpAppRenderer } from "./MCPAppRenderer";
import { SimpleToolCallUI } from "./SimpleToolCallUI";
import { ToolCallDisplay } from "./ToolCallDisplay";
import { getIconByName, getStatusIcon } from "./utils";

interface ToolCallDivProps {
  toolCallStates: ToolCallState[];
  historyIndex: number;
}

export function ToolCallDiv({
  toolCallStates,
  historyIndex,
}: ToolCallDivProps) {
  const reviewSummary = useMemo(
    () => getReviewBatchSummary(toolCallStates),
    [toolCallStates],
  );
  const hasActiveGroupedCall = toolCallStates.some(
    (toolCallState) =>
      toolCallState.status === "calling" ||
      toolCallState.status === "generating" ||
      toolCallState.status === "generated",
  );
  const isDenseBatch = toolCallStates.length >= 6;
  const isDenseCompletedBatch = isDenseBatch && !hasActiveGroupedCall;
  const shouldStartCollapsed =
    !hasActiveGroupedCall && (Boolean(reviewSummary) || isDenseBatch);
  const [open, setOpen] = useState(!shouldStartCollapsed);
  const previousHasActiveGroupedCall = useRef(hasActiveGroupedCall);
  const availableTools = useAppSelector(
    (state: RootState) => state.config.config.tools,
  );

  if (!toolCallStates?.length) return null;

  const shouldShowGroupedUI = toolCallStates.length > 1;
  const activeCalls = toolCallStates.filter(
    (call) => call.status !== "canceled",
  );
  const pendingCalls = toolCallStates.filter((call) => call.status !== "done");

  useEffect(() => {
    if (hasActiveGroupedCall) {
      setOpen(true);
    } else if (
      previousHasActiveGroupedCall.current &&
      (Boolean(reviewSummary) || isDenseCompletedBatch)
    ) {
      setOpen(false);
    }

    previousHasActiveGroupedCall.current = hasActiveGroupedCall;
  }, [hasActiveGroupedCall, reviewSummary, isDenseCompletedBatch]);

  const renderToolCall = (toolCallState: ToolCallState) => {
    const tool = availableTools.find(
      (tool) => toolCallState.toolCall.function?.name === tool.function.name,
    );
    const functionName = toolCallState.toolCall.function?.name;
    const icon =
      functionName && tool?.toolCallIcon
        ? getIconByName(tool.toolCallIcon)
        : undefined;
    const isCompactFunctionSpecificTool =
      functionName === BuiltInToolNames.SingleFindAndReplace ||
      functionName === BuiltInToolNames.MultiEdit ||
      functionName === BuiltInToolNames.RunTerminalCommand ||
      functionName === BuiltInToolNames.TodoWrite;

    if (isCompactFunctionSpecificTool) {
      return (
        <div className="flex flex-col px-0.5">
          <FunctionSpecificToolCallDiv
            toolCallState={toolCallState}
            historyIndex={historyIndex}
          />
        </div>
      );
    }

    if (isCoordinationSummaryTool(functionName)) {
      return (
        <ToolCallDisplay
          icon={getStatusIcon(toolCallState.status)}
          tool={tool}
          toolCallState={toolCallState}
          historyIndex={historyIndex}
        >
          <FunctionSpecificToolCallDiv
            toolCallState={toolCallState}
            historyIndex={historyIndex}
          />
        </ToolCallDisplay>
      );
    }

    if (toolCallState.mcpUiState) {
      return (
        <ToolCallDisplay
          icon={getStatusIcon(toolCallState.status)}
          tool={tool}
          toolCallState={toolCallState}
          historyIndex={historyIndex}
        >
          <McpAppRenderer toolCallState={toolCallState} />
        </ToolCallDisplay>
      );
    }

    if (icon) {
      return (
        <SimpleToolCallUI
          tool={tool}
          toolCallState={toolCallState}
          icon={toolCallState.status === "generated" ? ArrowRightIcon : icon}
          historyIndex={historyIndex}
        />
      );
    }

    return (
      <ToolCallDisplay
        icon={getStatusIcon(toolCallState.status)}
        tool={tool}
        toolCallState={toolCallState}
        historyIndex={historyIndex}
      >
        <FunctionSpecificToolCallDiv
          toolCallState={toolCallState}
          historyIndex={historyIndex}
        />
      </ToolCallDisplay>
    );
  };

  if (shouldShowGroupedUI) {
    return (
      <div
        className={`border-border fade-in-span rounded-lg border px-2.5 py-1.5 pb-0 transition-opacity duration-200 ${
          reviewSummary ? "bg-vsc-editor-background/35" : ""
        }`}
        data-testid="grouped-tool-call-container"
      >
        <GroupedToolCallHeader
          toolCallStates={toolCallStates}
          activeCalls={pendingCalls.length > 0 ? pendingCalls : activeCalls}
          open={open}
          onToggle={() => setOpen(!open)}
        />
        <div
          data-testid="grouped-tool-call-body"
          className={`overflow-y-auto transition-all duration-300 ease-in-out ${
            open ? "max-h-[50vh] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          {toolCallStates.map((toolCallState, index) => (
            <div
              className="py-0.5 pl-4"
              data-testid={`grouped-tool-call-row-${index}`}
              key={toolCallState.toolCallId}
            >
              {renderToolCall(toolCallState)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return toolCallStates.map((toolCallState) => (
    <div className="fade-in-span py-0.5" key={toolCallState.toolCallId}>
      {renderToolCall(toolCallState)}
    </div>
  ));
}
