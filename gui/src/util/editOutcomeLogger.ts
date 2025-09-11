import {
  ApplyState,
  BrowserSerializedContinueConfig,
  ToolCallState,
} from "core";
import { IIdeMessenger } from "../context/IdeMessenger";
import { ChatHistoryItemWithMessageId } from "../redux/slices/sessionSlice";

/**
 * Extract model information from tool call state
 */
function extractModelInfo(
  history: ChatHistoryItemWithMessageId[],
  config: BrowserSerializedContinueConfig,
  toolCallState: ToolCallState,
): {
  modelProvider: string;
  modelName: string;
  modelTitle: string;
} {
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
      modelName: modelParts[1] || String(assistantMessage.message.model),
      modelTitle: modelParts[1] || String(assistantMessage.message.model),
    };
  }

  // Fallback to config if not found in message
  const chatModel = config?.selectedModelByRole?.chat;

  return {
    modelProvider: chatModel?.provider || "unknown",
    modelName: chatModel?.model || "unknown",
    modelTitle: chatModel?.model || "unknown",
  };
}

/**
 * Extract prompt and completion from tool call state
 */
function extractPromptAndCompletion(
  history: ChatHistoryItemWithMessageId[],
  toolCallState: ToolCallState,
): {
  prompt: string;
  completion: string;
} {
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
  history: ChatHistoryItemWithMessageId[],
  config: BrowserSerializedContinueConfig,
  toolCallState: ToolCallState,
  applyState: ApplyState,
  accepted: boolean,
) {
  const modelInfo = extractModelInfo(history, config, toolCallState);
  const promptAndCompletion = extractPromptAndCompletion(
    history,
    toolCallState,
  );
  const codeChanges = extractCodeChanges(applyState);

  return {
    streamId: applyState.streamId,
    timestamp: new Date().toISOString(),
    modelProvider: modelInfo.modelProvider,
    modelName: modelInfo.modelName,
    modelTitle: modelInfo.modelName,
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
  history: ChatHistoryItemWithMessageId[],
  config: BrowserSerializedContinueConfig,
  toolCallState: ToolCallState,
  applyState: ApplyState,
  accepted: boolean,
  ideMessenger: IIdeMessenger,
): Promise<void> {
  // Use the original file content stored in applyState, captured before edits were applied

  const editOutcomeData = assembleEditOutcomeData(
    history,
    config,
    toolCallState,
    applyState,
    accepted,
  );

  ideMessenger.post("devdata/log", {
    name: "editOutcome",
    data: editOutcomeData,
  });
}
