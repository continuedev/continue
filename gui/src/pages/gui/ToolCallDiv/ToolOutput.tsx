import { ContextItemWithId, Tool, ToolCallState } from "core";
import { ComponentType, useMemo, useState } from "react";
import { ContextItemsPeekItem } from "../../../components/mainInput/belowMainInput/ContextItemsPeek";
import ToggleDiv from "../../../components/ToggleDiv";
import { ArgsToggleIcon } from "./ToolCallArgs";
import { ToolCallStatusMessage } from "./ToolCallStatusMessage";

interface SimpleToolCallUIProps {
  toolCallState: ToolCallState;
  tool: Tool | undefined;
  contextItems: ContextItemWithId[];
  icon?: ComponentType;
}

export function SimpleToolCallUI({
  contextItems,
  icon,
  toolCallState,
  tool,
}: SimpleToolCallUIProps) {
  const ctxItems = useMemo(() => {
    return contextItems?.filter((ctxItem) => !ctxItem.hidden) ?? [];
  }, [contextItems]);

  const [showingArgs, setShowingArgs] = useState(false);

  return (
    <ToggleDiv
      icon={icon}
      title={
        <div className="flex flex-row items-center justify-between">
          <div>
            <ToolCallStatusMessage tool={tool} toolCallState={toolCallState} />
          </div>
          <div>
            <ArgsToggleIcon
              isShowing={showingArgs}
              setIsShowing={setShowingArgs}
              toolCallId={toolCallState.toolCallId}
            />
          </div>
        </div>
      }
    >
      {ctxItems.length ? (
        ctxItems.map((contextItem, idx) => (
          <ContextItemsPeekItem key={idx} contextItem={contextItem} />
        ))
      ) : (
        <div className="pl-2 text-xs italic text-gray-400">
          No tool call output
        </div>
      )}
    </ToggleDiv>
  );
}
