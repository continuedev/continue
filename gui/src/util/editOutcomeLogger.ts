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
 * Extract only the changed lines from apply state using a simple diff approach
 */
function extractCodeChanges(applyState: ApplyState): {
  previousCode: string;
  newCode: string;  
  previousCodeLines: number;
  newCodeLines: number;
  lineChange: number;
} {
  // Use precise diff information if available (new approach)
  if (applyState.changedLines) {
    const { previousLines, newLines } = applyState.changedLines;
    const result = {
      previousCode: previousLines.join('\n'),
      newCode: newLines.join('\n'),
      previousCodeLines: previousLines.length,
      newCodeLines: newLines.length,
      lineChange: newLines.length - previousLines.length,
    };
    
    console.log("LOGGER_DEBUG:", JSON.stringify({
      usingChangedLines: true,
      previousLinesCount: previousLines.length,
      newLinesCount: newLines.length,
      previousLinesPreview: previousLines.slice(0, 3),
      newLinesPreview: newLines.slice(0, 3),
      result
    }, null, 2));
    
    return result;
  }
  
  // Fallback to old approach for backward compatibility
  let originalContent = applyState.originalFileContent || "";
  let newContent = applyState.fileContent || "";
  
  
  // Remove phantom leading newlines that appear in new content but not in original
  // These are display artifacts that don't actually get written to the file
  if (newContent.startsWith('\n') && !originalContent.startsWith('\n')) {
    const leadingNewlineMatch = newContent.match(/^(\n+)/);
    if (leadingNewlineMatch) {
      const phantomNewlines = leadingNewlineMatch[1];
      console.log(`Removing ${phantomNewlines.length} phantom leading newlines from newContent`);
      newContent = newContent.substring(phantomNewlines.length);
    }
  }
  

  // If either is empty, return the full content (new file or deleted file)
  if (originalContent === "" || newContent === "") {
    const previousCodeLines = originalContent === "" ? 0 : originalContent.split("\n").length;
    const newCodeLines = newContent === "" ? 0 : newContent.split("\n").length;
    
    return {
      previousCode: originalContent,
      newCode: newContent,
      previousCodeLines,
      newCodeLines,
      lineChange: newCodeLines - previousCodeLines,
    };
  }

  // Split into lines for comparison
  const originalLines = originalContent.split("\n");
  const newLines = newContent.split("\n");

  // For small changes (likely chat mode), try to identify actual content changes
  // instead of positional differences caused by whitespace changes
  const contentOnlyOriginal = originalLines.filter(line => line.trim() !== '');
  const contentOnlyNew = newLines.filter(line => line.trim() !== '');
  
  // If this looks like a small content change, extract just the changed content
  if (contentOnlyOriginal.length <= 20 && contentOnlyNew.length <= 20) {
    
    // For content-only changes, collect all different lines
    const originalDiffLines = [];
    const newDiffLines = [];
    
    const maxLength = Math.max(contentOnlyOriginal.length, contentOnlyNew.length);
    for (let i = 0; i < maxLength; i++) {
      const origLine = contentOnlyOriginal[i] || '';
      const newLine = contentOnlyNew[i] || '';
      
      if (origLine !== newLine) {
        if (origLine) originalDiffLines.push(origLine);
        if (newLine) newDiffLines.push(newLine);
      }
    }
    
    // If we found different content, return just the differences
    if (originalDiffLines.length > 0 || newDiffLines.length > 0) {
      
      return {
        previousCode: originalDiffLines.join('\n'),
        newCode: newDiffLines.join('\n'),
        previousCodeLines: originalDiffLines.length,
        newCodeLines: newDiffLines.length,
        lineChange: newDiffLines.length - originalDiffLines.length,
      };
    }
  }

  // Fallback to positional diff for larger changes
  let firstChangedLine = 0;
  let lastChangedLineOriginal = originalLines.length - 1;
  let lastChangedLineNew = newLines.length - 1;

  // Find first differing line from the start
  while (
    firstChangedLine < originalLines.length &&
    firstChangedLine < newLines.length &&
    originalLines[firstChangedLine] === newLines[firstChangedLine]
  ) {
    firstChangedLine++;
  }

  // Find last differing line from the end
  while (
    lastChangedLineOriginal >= firstChangedLine &&
    lastChangedLineNew >= firstChangedLine &&
    originalLines[lastChangedLineOriginal] === newLines[lastChangedLineNew]
  ) {
    lastChangedLineOriginal--;
    lastChangedLineNew--;
  }



  // Extract only the changed sections
  const changedOriginalLines = originalLines.slice(firstChangedLine, lastChangedLineOriginal + 1);
  const changedNewLines = newLines.slice(firstChangedLine, lastChangedLineNew + 1);

  console.log("EXTRACTED_LINES:", JSON.stringify({
    changedOriginalLines,
    changedNewLines,
    originalSliceRange: `[${firstChangedLine}:${lastChangedLineOriginal + 1}]`,
    newSliceRange: `[${firstChangedLine}:${lastChangedLineNew + 1}]`
  }, null, 2));

  const previousCode = changedOriginalLines.join("\n");
  const newCode = changedNewLines.join("\n");

  return {
    previousCode,
    newCode,
    previousCodeLines: changedOriginalLines.length,
    newCodeLines: changedNewLines.length,
    lineChange: changedNewLines.length - changedOriginalLines.length,
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
