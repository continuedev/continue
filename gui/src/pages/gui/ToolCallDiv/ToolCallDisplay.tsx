import { Tool, ToolCallState } from "core";
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
            <ToolCallStatusMessage tool={tool} toolCallState={toolCallState} />
          </div>
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}
