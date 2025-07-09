import { ToolCallState } from "core";
import { ToolCallDiv } from "./ToolCallDiv";

interface ToolCallsGroupProps {
  toolCallStates: ToolCallState[];
  historyIndex: number;
}

export function ToolCallsGroup({ 
  toolCallStates, 
  historyIndex
}: ToolCallsGroupProps) {
  if (!toolCallStates || toolCallStates.length === 0) return null;

  // Get the complete ToolCall objects from the tool call states
  const validToolCalls = toolCallStates.map(state => state.toolCall);

  // If multiple tool calls, group them under "Performing N actions"
  if (validToolCalls.length > 1) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 mb-2">
        <div 
          className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3"
          data-testid="performing-actions"
        >
          Performing {validToolCalls.length} actions
        </div>
        <div className="space-y-2">
          {toolCallStates.map((toolCallState) => (
            <ToolCallDiv
              key={toolCallState.toolCallId}
              toolCallState={toolCallState}
              toolCall={toolCallState.toolCall}
              historyIndex={historyIndex}
            />
          ))}
        </div>
      </div>
    );
  }

  // Single tool call - render as before
  return (
    <div>
      {toolCallStates.map((toolCallState) => (
        <ToolCallDiv
          key={toolCallState.toolCallId}
          toolCallState={toolCallState}
          toolCall={toolCallState.toolCall}
          historyIndex={historyIndex}
        />
      ))}
    </div>
  );
}