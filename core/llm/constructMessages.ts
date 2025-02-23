import {
  ChatHistoryItem,
  ChatMessage,
  MessagePart,
  ModelDescription,
} from "../";
import { normalizeToMessageParts } from "../util/messageContent";

import { modelSupportsTools } from "./autodetect";

const CUSTOM_SYS_MSG_MODEL_FAMILIES = ["sonnet"];

const SYSTEM_MESSAGE = `When generating new code:

1. Always produce a single code block.
2. Never separate the code into multiple code blocks.
3. Only include the code that is being added.
4. Replace existing code with a "lazy" comment like this: "// ... existing code ..."
5. The "lazy" comment must always be a valid comment in the current context (e.g. "<!-- ... existing code ... -->" for HTML, "// ... existing code ..." for JavaScript, "{/* ... existing code */}" for TSX, etc.)
6. You must always provide 1-2 lines of context above and below a "lazy" comment
7. If the user submits a code block that contains a filename in the language specifier, always include the filename in any code block you generate based on that file. The filename should be on the same line as the language specifier in your code block.

Example 1:
Input:
\`\`\`test.js
import addition from "addition"

class Calculator {
  constructor() {
    this.result = 0;
  }
    
  add(number) {
    this.result += number;
    return this;
  }
}
\`\`\`
User request: Add a subtract method

Output:
\`\`\`javascript test.js
// ... existing code ...
import subtraction from "subtraction"

class Calculator {
  // ... existing code ...
  
  subtract(number) {
    this.result -= number;
    return this;
  }
}
\`\`\`

Example 2:
Input:
\`\`\`javascript test.js (6-9)
function helloWorld() {}
\`\`\`

Output:
\`\`\`javascript test.js
function helloWorld() {
  // New code here
}
\`\`\`

Always follow these guidelines when generating code responses.`;

const TOOL_USE_RULES = `When using tools, follow the following guidelines:
- Avoid calling tools unless they are absolutely necessary. For example, if you are asked a simple programming question you do not need web search. As another example, if the user asks you to explain something about code, do not create a new file.`;

function constructSystemPrompt(
  modelDescription: ModelDescription,
  useTools: boolean,
): string | null {
  let systemMessage = "";
  if (
    CUSTOM_SYS_MSG_MODEL_FAMILIES.some((family) =>
      modelDescription.model.includes(family),
    )
  ) {
    systemMessage = SYSTEM_MESSAGE;
  }
  if (useTools && modelSupportsTools(modelDescription)) {
    if (systemMessage) {
      systemMessage += "\n\n";
    }
    systemMessage += TOOL_USE_RULES;
  }
  return systemMessage || null;
}

const CANCELED_TOOL_CALL_MESSAGE =
  "This tool call was cancelled by the user. You should clarify next steps, as they don't wish for you to use this tool.";

export function constructMessages(
  history: ChatHistoryItem[],
  modelDescription: ModelDescription,
  useTools: boolean,
): ChatMessage[] {
  const filteredHistory = history.filter(
    (item) => item.message.role !== "system",
  );
  const msgs: ChatMessage[] = [];

  const systemMessage = constructSystemPrompt(modelDescription, useTools);
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
