import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  ModelProvider,
} from "../../index.js";
import { stripImages } from "../images.js";
import { BaseLLM } from "../index.js";
import { streamSse } from "../stream.js";

class Anthropic extends BaseLLM {
  static providerName: ModelProvider = "anthropic";
  static defaultOptions: Partial<LLMOptions> = {
    model: "claude-3-5-sonnet-20240620",
    contextLength: 200_000,
    completionOptions: {
      model: "claude-3-5-sonnet-20240620",
      maxTokens: 4096,
    },
    apiBase: "https://api.anthropic.com/v1/",
  };

  static lazySystemMessage: string = `When generating new code:

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

  private _convertArgs(options: CompletionOptions) {
    const finalOptions = {
      top_k: options.topK,
      top_p: options.topP,
      temperature: options.temperature,
      max_tokens: options.maxTokens ?? 2048,
      model: options.model === "claude-2" ? "claude-2.1" : options.model,
      stop_sequences: options.stop?.filter((x) => x.trim() !== ""),
      stream: options.stream ?? true,
    };

    return finalOptions;
  }

  private _convertMessages(msgs: ChatMessage[]): any[] {
    const messages = msgs
      .filter((m) => m.role !== "system")
      .map((message) => {
        if (typeof message.content === "string") {
          return message;
        }
        return {
          ...message,
          content: message.content.map((part) => {
            if (part.type === "text") {
              return part;
            }
            return {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: part.imageUrl?.url.split(",")[1],
              },
            };
          }),
        };
      });
    return messages;
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const messages = [{ role: "user" as const, content: prompt }];
    for await (const update of this._streamChat(messages, options)) {
      yield stripImages(update.content);
    }
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const shouldCacheSystemMessage =
      !!this.systemMessage && !!this.cacheSystemMessage;

    // This likely should be set in the base class where we wrap
    // _streamChat in a try/catch
    let curSystemMsg = this.systemMessage;

    // We only are doing lazy prompting with Sonnet right now
    if (
      this.hasCodeBlockWithFilename(messages[0].content) &&
      options.model?.includes("sonnet")
    ) {
      this.systemMessage = `${this.systemMessage} ${Anthropic.lazySystemMessage}`;
    }

    const response = await this.fetch(new URL("messages", this.apiBase), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": this.apiKey as string,
        ...(shouldCacheSystemMessage
          ? { "anthropic-beta": "prompt-caching-2024-07-31" }
          : {}),
      },
      body: JSON.stringify({
        ...this._convertArgs(options),
        messages: this._convertMessages(messages),
        system: shouldCacheSystemMessage
          ? [
              {
                type: "text",
                text: this.systemMessage,
                cache_control: { type: "ephemeral" },
              },
            ]
          : this.systemMessage,
      }),
    });

    if (options.stream === false) {
      const data = await response.json();
      yield { role: "assistant", content: data.content[0].text };
      return;
    }

    for await (const value of streamSse(response)) {
      if (value.delta?.text) {
        yield { role: "assistant", content: value.delta.text };
      }
    }

    this.systemMessage = curSystemMsg;
  }
}

export default Anthropic;
