import { Tool, ToolCallState } from "core";
import { renderContextItems } from "core/util/messageContent";
import { useContext } from "react";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { ToolCallStatusMessage } from "./ToolCallStatusMessage";

interface ToolCallDisplayProps {
  children: React.ReactNode;
  icon: React.ReactNode;
  tool: Tool | undefined;
  toolCallState: ToolCallState;
  historyIndex: number;
}

export function ToolCallDisplay({
  tool,
  toolCallState,
  children,
  icon,
  historyIndex,
}: ToolCallDisplayProps) {
  const ideMessenger = useContext(IdeMessengerContext);

  function handleToolCallTextClick() {
    if (toolCallState.output) {
      ideMessenger.post("showVirtualFile", {
        name: "Tool Output",
        content: renderContextItems(toolCallState.output),
      });
    }
  }
  return (
    <div className="flex flex-col justify-center px-4">
      <div className="mb-2 flex flex-col">
        <div className="flex flex-row items-center justify-between gap-1.5">
          <div className="flex min-w-0 flex-row items-center gap-2">
            <div className="mt-[1px] h-4 w-4 flex-shrink-0 font-semibold">
              {icon}
            </div>
            {tool?.faviconUrl && (
              <img src={tool.faviconUrl} className="h-4 w-4 rounded-sm" />
            )}
            <ToolCallStatusMessage 
              tool={tool} 
              toolCallState={toolCallState} 
              onClick={handleToolCallTextClick}
            />
          </div>
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}
