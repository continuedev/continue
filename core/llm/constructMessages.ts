import {
  BrowserSerializedContinueConfig,
  ChatHistoryItem,
  ChatMessage,
  MessagePart,
  ModelDescription,
} from "../";
import { normalizeToMessageParts } from "../util/messageContent";

import { modelSupportsTools } from "./autodetect";

const TOOL_USE_RULES = `When using tools, follow the following guidelines:
- Avoid calling tools unless they are absolutely necessary. For example, if you are asked a simple programming question you do not need web search. As another example, if the user asks you to explain something about code, do not create a new file.`;

const CODE_BLOCK_INSTRUCTIONS = "Always include the language and file name in the info string when you write code blocks, for example '```python file.py'."

// Helper function to strip whitespace
function stripWhitespace(text: string, stripLeading = false, stripTrailing = false): string {
  let result = text;
  if (stripLeading) {
    result = result.replace(/^[\s\n]+/, '');
  }
  if (stripTrailing) {
    result = result.replace(/[\s\n]+$/, '');
  }
  return result;
}

// Helper function for placeholder replacement with whitespace handling
function replacePlaceholder(
  text: string,
  placeholder: string,
  replacement: string
): string {
  if (!text.includes(placeholder)) {
    return text;
  }

  const placeholderIndex = text.indexOf(placeholder);
  const placeholderLength = placeholder.length;

  // Check surroundings to determine whitespace needs
  const isAtBeginning = placeholderIndex === 0;
  const isAtEnd = placeholderIndex + placeholderLength === text.length;

  if (!replacement) {
    // No replacement to add - just replace with empty string and clean up
    let processed = text.replace(placeholder, "");
    return stripWhitespace(processed, isAtBeginning, isAtEnd);
  } else {
    // Add replacement with appropriate whitespace
    let formattedReplacement = replacement;

    if (!isAtBeginning && !(/[\n\s]$/.test(text.substring(0, placeholderIndex)))) {
      formattedReplacement = "\n\n" + formattedReplacement;
    };

    if (!isAtEnd && !(/^[\n\s]/.test(text.substring(placeholderIndex + placeholderLength)))) {
      formattedReplacement = formattedReplacement + "\n\n";
    };

    return text.replace(placeholder, formattedReplacement);
  }
}

function constructSystemPrompt(
  modelDescription: ModelDescription,
  useTools: boolean,
  continueConfig: BrowserSerializedContinueConfig
): string | null {

  let systemMessage = "";
  // We we have no access to the LLM class, we final systemMessage have to be the same as in core/llm/index.ts
  const userSystemMessage = modelDescription.systemMessage ?? continueConfig.systemMessage;

  // Get templates from model description or use defaults
  const codeBlockTemplate = modelDescription.promptTemplates?.codeBlockInstructions ?? CODE_BLOCK_INSTRUCTIONS;

  const toolUseTemplate = modelDescription.promptTemplates?.toolUseRules ?? TOOL_USE_RULES;

  // Determine which instructions to include
  const codeBlockInstructions = codeBlockTemplate;
  const toolUseInstructions = useTools && modelSupportsTools(modelDescription) ? toolUseTemplate : "";

  switch ((continueConfig.experimental?.systemMessageComposition || "legacy")) {
    case "prepend":
      // Put user system message first, then default instructions
      systemMessage = userSystemMessage || "";

      if (systemMessage && codeBlockInstructions) {
        systemMessage += "\n\n" + codeBlockInstructions;
      } else if (codeBlockInstructions) {
        systemMessage = codeBlockInstructions;
      }

      if (systemMessage && toolUseInstructions) {
        systemMessage += "\n\n" + toolUseInstructions;
      } else if (toolUseInstructions) {
        systemMessage = toolUseInstructions;
      }
      break;

    case "placeholders":
    case "placeholders":
      if (userSystemMessage) {
        // Define placeholders
        const allDefaultInstructions = [
          codeBlockInstructions,
          toolUseInstructions
        ].filter(Boolean).join("\n\n");

        // Replace placeholders in user system message
        let processedMessage = userSystemMessage;

        // Replace all placeholders using our helper function
        processedMessage = replacePlaceholder(
          processedMessage,
          "{DEFAULT_INSTRUCTIONS}",
          allDefaultInstructions
        );

        processedMessage = replacePlaceholder(
          processedMessage,
          "{CODE_BLOCK_INSTRUCTIONS}",
          codeBlockInstructions
        );

        processedMessage = replacePlaceholder(
          processedMessage,
          "{TOOL_USE_RULES}",
          toolUseInstructions
        );

        systemMessage = processedMessage;
      } else {
        // Fall back to legacy behavior if no user system message
        systemMessage = codeBlockInstructions;
        if (toolUseInstructions) {
          systemMessage += "\n\n" + toolUseInstructions;
        }
      }
      break;


    case "legacy":
    case "append":
    default:
      systemMessage = codeBlockInstructions;
      if (useTools && modelSupportsTools(modelDescription)) {
        systemMessage += "\n\n" + toolUseTemplate;
      }
      // logic moved from core/llm/countTokens.ts
      if (userSystemMessage && userSystemMessage.trim() !== "") {
        const shouldAddNewLines = systemMessage !== "";
        if (shouldAddNewLines) {
          systemMessage += "\n\n";
        }
        systemMessage += userSystemMessage;
      }
      if (userSystemMessage === "") {
        // Used defined explicit empty system message will be forced
        systemMessage = "";
      }
      break;
  }

  return systemMessage;
}

const CANCELED_TOOL_CALL_MESSAGE =
  "This tool call was cancelled by the user. You should clarify next steps, as they don't wish for you to use this tool.";

export function constructMessages(
  history: ChatHistoryItem[],
  modelDescription: ModelDescription,
  useTools: boolean,
  continueConfig: BrowserSerializedContinueConfig,
): ChatMessage[] {
  const filteredHistory = history.filter(
    (item) => item.message.role !== "system",
  );
  const msgs: ChatMessage[] = [];

  const systemMessage = constructSystemPrompt(modelDescription, useTools, continueConfig);
  if (systemMessage) {
    msgs.push({
      role: "system",
      content: systemMessage,
    });
  }

  for (let i = 0; i < filteredHistory.length; i++) {
    const historyItem = filteredHistory[i];

    if (historyItem.message.role === "user") {
      // Gather context items for user messages
      let content = normalizeToMessageParts(historyItem.message);

      const ctxItems = historyItem.contextItems.map((ctxItem) => {
        return { type: "text", text: `${ctxItem.content}\n` } as MessagePart;
      });

      content = [...ctxItems, ...content];
      msgs.push({
        ...historyItem.message,
        content,
      });
    } else if (historyItem.toolCallState?.status === "canceled") {
      // Canceled tool call
      msgs.push({
        ...historyItem.message,
        content: CANCELED_TOOL_CALL_MESSAGE,
      });
    } else {
      msgs.push(historyItem.message);
    }
  }

  // Remove the "id" from all of the messages
  return msgs.map((msg) => {
    const { id, ...rest } = msg as any;
    return rest;
  });
}
