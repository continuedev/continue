import {
  ArrowRightIcon,
  ChevronRightIcon,
  FolderIcon,
} from "@heroicons/react/24/outline";
import { ToolCallState } from "core";
import { useState } from "react";
import { useAppSelector } from "../../../redux/hooks";
import FunctionSpecificToolCallDiv from "./FunctionSpecificToolCallDiv";
import { SimpleToolCallUI } from "./SimpleToolCallUI";
import { ToolCallDisplay } from "./ToolCall";
import { getGroupActionVerb, getStatusIcon, toolCallIcons } from "./utils";

interface ToolCallDivProps {
  toolCallStates: ToolCallState[];
  historyIndex: number;
}

export function ToolCallDiv({
  toolCallStates,
  historyIndex,
}: ToolCallDivProps) {
  const [open, setOpen] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const availableTools = useAppSelector((state) => state.config.config.tools);

  if (!toolCallStates || toolCallStates.length === 0) return null;

  const validToolCalls = toolCallStates.map((state) => state.toolCall);

  if (validToolCalls.length > 1) {
    const showChevron = isHovered || open;

    return (
      <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <div
          className="text-description flex cursor-pointer items-center gap-1.5 transition-colors duration-200 ease-in-out hover:brightness-125"
          data-testid="performing-actions"
          onClick={() => setOpen((prev) => !prev)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="flex h-4 w-4 flex-shrink-0 flex-col items-center justify-center">
            {showChevron ? (
              <ChevronRightIcon
                className={`text-description h-4 w-4 transition-transform duration-200 ease-in-out ${
                  open ? "rotate-90" : "rotate-0"
                }`}
              />
            ) : (
              <FolderIcon className="text-description h-4 w-4" />
            )}
          </div>
          {getGroupActionVerb(toolCallStates)} {validToolCalls.length} actions
        </div>
        <div
          className={`overflow-y-auto transition-all duration-300 ease-in-out ${
            open ? "mt-2 max-h-[50vh] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          {toolCallStates.map((toolCallState) => (
            <div className="py-1 pl-6" key={toolCallState.toolCallId}>
              {(() => {
                const tool = availableTools.find(
                  (tool) =>
                    toolCallState.toolCall.function?.name ===
                    tool.function.name,
                );
                const icon =
                  toolCallState.toolCall.function?.name &&
                  toolCallIcons[toolCallState.toolCall.function.name];

                if (icon) {
                  return (
                    <SimpleToolCallUI
                      tool={tool}
                      toolCallState={toolCallState}
                      icon={
                        toolCallState.status === "generated"
                          ? ArrowRightIcon
                          : icon
                      }
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
                      toolCall={toolCallState.toolCall}
                      toolCallState={toolCallState}
                      historyIndex={historyIndex}
                    />
                  </ToolCallDisplay>
                );
              })()}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {toolCallStates.map((toolCallState) => (
        <div className="p-2" key={toolCallState.toolCallId}>
          {(() => {
            const tool = availableTools.find(
              (tool) =>
                toolCallState.toolCall.function?.name === tool.function.name,
            );
            const icon =
              toolCallState.toolCall.function?.name &&
              toolCallIcons[toolCallState.toolCall.function.name];

            if (icon) {
              return (
                <SimpleToolCallUI
                  tool={tool}
                  toolCallState={toolCallState}
                  icon={
                    toolCallState.status === "generated" ? ArrowRightIcon : icon
                  }
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
                  toolCall={toolCallState.toolCall}
                  toolCallState={toolCallState}
                  historyIndex={historyIndex}
                />
              </ToolCallDisplay>
            );
          })()}
        </div>
      ))}
    </div>
  );
}
