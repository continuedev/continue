import { ToolCallState } from "core";
import { UnifiedTerminalCommand } from "../../../components/UnifiedTerminal/UnifiedTerminal";

interface RunTerminalCommandToolCallProps {
  command: string;
  toolCallState: ToolCallState;
  toolCallId: string | undefined;
}

export function RunTerminalCommand(props: RunTerminalCommandToolCallProps) {
  // For errored status, show any output (error messages)
  // Otherwise look for terminal output specifically
  const isErrored = props.toolCallState.status === "errored";
  const outputItem = isErrored
    ? props.toolCallState.output?.[0] // Get first output item for errors
    : props.toolCallState.output?.find((item) => item.name === "Terminal");

  const terminalContent = outputItem?.content || "";
  const statusMessage = outputItem?.status || "";
  const isRunning = props.toolCallState.status === "calling";

  // Determine status type
  let statusType: "running" | "completed" | "failed" | "background" =
    "completed";
  if (isRunning) {
    statusType = "running";
  } else if (isErrored || statusMessage?.includes("failed")) {
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
