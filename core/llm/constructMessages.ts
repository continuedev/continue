import { ChatHistory, ChatMessage, MessagePart } from "../index.js";

const SYSTEM_MESSAGE = `When generating new code:

1. Always produce a single code block.
2. Never separate the code into multiple code blocks.
3. Only include the code that is being added.
4. Replace existing code with a "lazy" block like this: "// ... existing code ..."
5. You must always provide 1-2 lines of context above and below a "lazy" block
6. If the user submits a code block that contains a filename in the language specifier, always include the filename in any code block you generate based on that file. The filename should be on the same line as the language specifier in your code block.

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

function hasCodeBlockWithFilename(content: ChatMessage["content"]): boolean {
  const contentStr = typeof content === "string" ? content : content[0].text;

  if (!contentStr) {
    return false;
  }

  const codeBlockRegex = /```[\w\W]*?\.[\w\W]*/;
  return codeBlockRegex.test(contentStr);
}

export function constructMessages(
  history: ChatHistory,
  model: string,
): ChatMessage[] {
  const msgs = [];

  // Only using this system message with Sonnet right now
  if (
    // hasCodeBlockWithFilename(history[0].message.content) &&
    model.includes("sonnet")
  ) {
    msgs.push({
      role: "system" as const,
      content: SYSTEM_MESSAGE,
    });
  }

  for (let i = 0; i < history.length; i++) {
    const historyItem = history[i];

    let content = Array.isArray(historyItem.message.content)
      ? historyItem.message.content
      : [{ type: "text", text: historyItem.message.content } as MessagePart];

    const ctxItems = historyItem.contextItems.map((ctxItem) => {
      return { type: "text", text: `${ctxItem.content}\n` } as MessagePart;
    });

    content = [...ctxItems, ...content];

    msgs.push({
      role: historyItem.message.role,
      content,
    });
  }

  return msgs;
}
