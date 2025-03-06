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

function constructSystemPrompt(
  modelDescription: ModelDescription,
  useTools: boolean,
  continueConfig: BrowserSerializedContinueConfig
): string | null {

  let systemMessage = ""
  // We we have no access to the LLM class, we final systemMessage have to be the same as in core/llm/index.ts
  const userSystemMessage = modelDescription.systemMessage ?? continueConfig.systemMessage;

  // Get templates from model description or use defaults
  const codeBlockTemplate = modelDescription.promptTemplates?.codeBlockInstructions || CODE_BLOCK_INSTRUCTIONS;

  const toolUseTemplate = modelDescription.promptTemplates?.toolUseRules || TOOL_USE_RULES;

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
      if (userSystemMessage) {
        // Define placeholders
        const allDefaultInstructions = [
          codeBlockInstructions,
          toolUseInstructions
        ].filter(Boolean).join("\n\n");

        // Replace placeholders in user system message
        let processedMessage = userSystemMessage;

        // Replace the all-in-one placeholder
        if (processedMessage.includes("{DEFAULT_INSTRUCTIONS}")) {
          processedMessage = processedMessage.replace("{DEFAULT_INSTRUCTIONS}", allDefaultInstructions);
        }

        // Replace individual placeholders
        if (processedMessage.includes("{CODE_BLOCK_INSTRUCTIONS}")) {
          processedMessage = processedMessage.replace("{CODE_BLOCK_INSTRUCTIONS}", codeBlockInstructions);
        }

        if (processedMessage.includes("{TOOL_USE_RULES}") && toolUseInstructions) {
          processedMessage = processedMessage.replace("{TOOL_USE_RULES}", toolUseInstructions);
        }

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
