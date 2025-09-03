import { services } from "../../services/index.js";

export const handleBashModeProcessing = async (
  message: string,
): Promise<string | null> => {
  // Handle bash mode commands (starting with !)
  if (!message.trimStart().startsWith("!")) {
    return message;
  }

  // Extract the command after the !
  const bashCommand = message.trimStart().slice(1).trim();

  if (!bashCommand) {
    return message; // No command provided, treat as regular message
  }

  // Show tool call immediately, then run asynchronously and populate result
  const toolCallId = `bash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const toolCall = {
    id: toolCallId,
    type: "function" as const,
    function: {
      name: "Bash",
      arguments: JSON.stringify({ command: bashCommand }),
    },
  };

  // Add assistant message with tool call immediately
  services.chatHistory.addAssistantMessage("", [toolCall as any]);
  // Mark as calling for immediate UI feedback
  services.chatHistory.updateToolStatus(toolCallId, "calling");

  // Execute the bash command asynchronously - don't block UI
  (async () => {
    try {
      const { runTerminalCommandTool } = await import(
        "../../tools/runTerminalCommand.js"
      );
      const result = await runTerminalCommandTool.run({
        command: bashCommand,
      });
      services.chatHistory.addToolResult(toolCallId, result, "done");
    } catch (error: any) {
      const errorMessage = `Bash command failed: ${error?.message || String(error)}`;
      services.chatHistory.addToolResult(toolCallId, errorMessage, "errored");
    }
  })();

  return null; // Processed, no further message handling needed
};
