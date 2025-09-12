import { runTerminalCommandTool } from "src/tools/runTerminalCommand.js";
import { getErrorString } from "src/util/error.js";

import { services } from "../../services/index.js";

export const handleBashModeProcessing = async (
  message: string,
): Promise<string | null> => {
  // Handle shell mode commands (starting with !)
  if (!message.trimStart().startsWith("!")) {
    return message;
  }

  // Extract the command after the !
  const bashCommand = message.trimStart().slice(1).trim();

  if (!bashCommand) {
    return message; // No command provided, treat as regular message
  }

  // Show tool call immediately, then run asynchronously and populate result
  const toolCallId = `shell-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const toolCall = {
    id: toolCallId,
    type: "function" as const,
    function: {
      name: "Bash",
      arguments: JSON.stringify({ command: bashCommand }),
    },
  };

  // Add assistant message with tool call immediately
  services.chatHistory.addAssistantMessage("", [toolCall]);
  // Mark as calling for immediate UI feedback
  services.chatHistory.updateToolStatus(toolCallId, "calling");

  // Execute the bash command asynchronously - don't block UI
  void runTerminalCommandTool
    .run({
      command: bashCommand,
    })
    .then((result) => {
      services.chatHistory.addToolResult(toolCallId, result, "done");
    })
    .catch((error) => {
      const errorMessage = `Bash command failed: ${getErrorString(error)}`;
      services.chatHistory.addToolResult(toolCallId, errorMessage, "errored");
    });

  return null; // Processed, no further message handling needed
};
