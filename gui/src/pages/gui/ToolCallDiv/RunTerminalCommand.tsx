import { ToolCallState } from "core";
import { UnifiedTerminalCommand } from "../../../components/UnifiedTerminal/UnifiedTerminal";

interface RunTerminalCommandToolCallProps {
  command: string;
  toolCallState: ToolCallState;
  toolCallId: string | undefined;
}

export function RunTerminalCommand(props: RunTerminalCommandToolCallProps) {
  // Find the terminal output from context items if available
  const terminalItem = props.toolCallState.output?.find(
    (item) => item.name === "Terminal",
  );

  const terminalContent = terminalItem?.content || "";
  const statusMessage = terminalItem?.status || "";
  const isRunning = props.toolCallState.status === "calling";

  // Determine status type
  let statusType: "running" | "completed" | "failed" | "background" =
    "completed";
  if (isRunning) {
    statusType = "running";
  } else if (statusMessage?.includes("failed")) {
    statusType = "failed";
  } else if (statusMessage?.includes("background")) {
    statusType = "background";
  }

  return (
    <UnifiedTerminalCommand
      command={props.command}
      output={terminalContent}
      status={statusType}
      statusMessage={statusMessage}
      toolCallState={props.toolCallState}
      toolCallId={props.toolCallId}
    />
  );
}
