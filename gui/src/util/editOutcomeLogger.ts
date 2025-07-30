import { ApplyState, ToolCall, ToolCallState } from "core";
import { IIdeMessenger } from "../context/IdeMessenger";
import { store } from "../redux/store";

/**
 * Extract model information from tool call state
 */
function extractModelInfo(toolCallState: ToolCallState): {
  modelProvider: string;
  modelTitle: string;
} {
  // Get the conversation history to find the model info
  const history = store.getState().session.history;

  // Find the assistant message that contains this tool call
  const assistantMessage = history.find(
    (item) =>
      item.message.role === "assistant" &&
      item.message.toolCalls?.some((tc) => tc.id === toolCallState.toolCallId),
  );

  if (
    assistantMessage?.message.role === "assistant" &&
    "model" in assistantMessage.message &&
    assistantMessage.message.model
  ) {
    // Extract provider from model string (e.g., "anthropic::claude-3-5-sonnet" -> "anthropic")
    const modelParts = String(assistantMessage.message.model).split("::");
    return {
      modelProvider: modelParts[0] || "unknown",
      modelTitle: modelParts[1] || String(assistantMessage.message.model),
    };
  }

  // Fallback to config if not found in message
  const config = store.getState().config.config;
  const chatModel = config?.selectedModelByRole?.chat;

  return {
    modelProvider: chatModel?.provider || "unknown",
    modelTitle: chatModel?.model || "unknown",
  };
}

/**
 * Extract prompt and completion from tool call state
 */
function extractPromptAndCompletion(toolCallState: ToolCallState): {
  prompt: string;
  completion: string;
} {
  const history = store.getState().session.history;

  // Find the assistant message with this tool call
  const assistantMessageIndex = history.findIndex(
    (item) =>
      item.message.role === "assistant" &&
      item.message.toolCalls?.some((tc) => tc.id === toolCallState.toolCallId),
  );

  if (assistantMessageIndex >= 0) {
    const assistantMessage = history[assistantMessageIndex];

    // Look for the most recent user message before this assistant message
    let userMessage = null;
    for (let i = assistantMessageIndex - 1; i >= 0; i--) {
      if (history[i].message.role === "user") {
        userMessage = history[i];
        break;
      }
    }

    const promptContent = userMessage
      ? Array.isArray(userMessage.message.content)
        ? userMessage.message.content
            .map((part) =>
              typeof part === "string"
                ? part
                : part.type === "text"
                  ? part.text || ""
                  : "",
            )
            .join("")
        : userMessage.message.content || ""
      : "";

    const completionContent = Array.isArray(assistantMessage.message.content)
      ? assistantMessage.message.content
          .map((part) =>
            typeof part === "string"
              ? part
              : part.type === "text"
                ? part.text || ""
                : "",
          )
          .join("")
      : assistantMessage.message.content || "";

    return {
      prompt: promptContent,
      completion: completionContent,
    };
  }

  return {
    prompt: "Unknown prompt",
    completion: "Unknown completion",
  };
}

/**
 * Extract code changes from apply state
 */
function extractCodeChanges(applyState: ApplyState): {
  previousCode: string;
  newCode: string;
  previousCodeLines: number;
  newCodeLines: number;
  lineChange: number;
} {
  // Use the original file content if provided, otherwise empty string
  const previousCode = applyState.originalFileContent || "";
  const newCode = applyState.fileContent || "";

  // Calculate line counts properly - empty string should be 0 lines, not 1
  const previousCodeLines =
    previousCode === "" ? 0 : previousCode.split("\n").length;
  const newCodeLines = newCode === "" ? 0 : newCode.split("\n").length;
  const lineChange = newCodeLines - previousCodeLines;

  return {
    previousCode,
    newCode,
    previousCodeLines,
    newCodeLines,
    lineChange,
  };
}

/**
 * Assemble complete edit outcome data from tool call and apply state
 */
export function assembleEditOutcomeData(
  toolCallState: ToolCallState,
  applyState: ApplyState,
  accepted: boolean,
) {
  const modelInfo = extractModelInfo(toolCallState);
  const promptAndCompletion = extractPromptAndCompletion(toolCallState);
  const codeChanges = extractCodeChanges(applyState);

  return {
    streamId: applyState.streamId,
    timestamp: new Date().toISOString(),
    modelProvider: modelInfo.modelProvider,
    modelTitle: modelInfo.modelTitle,
    prompt: promptAndCompletion.prompt,
    completion: promptAndCompletion.completion,
    previousCode: codeChanges.previousCode,
    newCode: codeChanges.newCode,
    filepath: applyState.filepath || "",
    previousCodeLines: codeChanges.previousCodeLines,
    newCodeLines: codeChanges.newCodeLines,
    lineChange: codeChanges.lineChange,
    accepted,
  };
}

/**
 * Log Agent Mode edit outcome to editOutcome.jsonl
 */
export async function logAgentModeEditOutcome(
  toolCallState: ToolCallState,
  applyState: ApplyState,
  accepted: boolean,
  ideMessenger: IIdeMessenger,
): Promise<void> {
  // Use the original file content stored in applyState, captured before edits were applied

  const editOutcomeData = assembleEditOutcomeData(
    toolCallState,
    applyState,
    accepted,
  );

  ideMessenger.post("devdata/log", {
    name: "editOutcome",
    data: editOutcomeData,
  });
}

/**
 * Log Chat Mode edit outcome to editOutcome.jsonl
 */
export async function logChatModeEditOutcome(
  applyState: ApplyState,
  accepted: boolean,
  ideMessenger: IIdeMessenger,
): Promise<void> {
  console.log("logChatModeEditOutcome called with:", { applyState, accepted });
  // For chat mode, we need to find the tool call state from the apply state
  const history = store.getState().session.history;
  
  // Find the tool call associated with this apply state if it exists
  let toolCallState: ToolCallState | null = null;
  
  if (applyState.toolCallId) {
    // Find the assistant message that contains this tool call
    const assistantMessage = history.find(
      (item) =>
        item.message.role === "assistant" &&
        item.message.toolCalls?.some((tc) => tc.id === applyState.toolCallId),
    );
    
    if (assistantMessage?.message.role === "assistant" && assistantMessage.message.toolCalls) {
      const toolCallDelta = assistantMessage.message.toolCalls.find((tc) => tc.id === applyState.toolCallId);
      if (toolCallDelta && toolCallDelta.id && toolCallDelta.function?.name && toolCallDelta.function?.arguments) {
        // Convert ToolCallDelta to ToolCall
        const toolCall: ToolCall = {
          id: toolCallDelta.id,
          type: "function",
          function: {
            name: toolCallDelta.function.name,
            arguments: toolCallDelta.function.arguments,
          },
        };
        
        toolCallState = {
          toolCallId: applyState.toolCallId,
          toolCall,
          status: accepted ? "done" : "canceled",
          parsedArgs: {},
        };
      }
    }
  }

  if (toolCallState) {
    // If we have a tool call, use the same logic as agent mode
    const editOutcomeData = assembleEditOutcomeData(
      toolCallState,
      applyState,
      accepted,
    );

    ideMessenger.post("devdata/log", {
      name: "editOutcome",
      data: editOutcomeData,
    });
  } else {
    // For manual chat mode interactions without tool calls, create minimal data
    const codeChanges = extractCodeChanges(applyState);
    const config = store.getState().config.config;
    const chatModel = config?.selectedModelByRole?.chat;

    const editOutcomeData = {
      streamId: applyState.streamId,
      timestamp: new Date().toISOString(),
      modelProvider: chatModel?.provider || "unknown",
      modelTitle: chatModel?.model || "unknown",
      prompt: "Chat mode manual apply", // Placeholder for manual applies
      completion: "Code applied via chat", // Placeholder for manual applies
      previousCode: codeChanges.previousCode,
      newCode: codeChanges.newCode,
      filepath: applyState.filepath || "",
      previousCodeLines: codeChanges.previousCodeLines,
      newCodeLines: codeChanges.newCodeLines,
      lineChange: codeChanges.lineChange,
      accepted,
    };

    ideMessenger.post("devdata/log", {
      name: "editOutcome",
      data: editOutcomeData,
    });
  }
}
