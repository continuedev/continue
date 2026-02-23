import { ChatMessage, CompletionOptions, LLMOptions } from "../../index.js";
import { BaseLLM } from "../index.js";

type MockMessage =
  | ChatMessage
  | "REPEAT_LAST_MSG"
  | "REPEAT_SYSTEM_MSG"
  | "ERROR";

class MockLLM extends BaseLLM {
  public completion: string = "Test Completion";
  public chatStreams: MockMessage[][] | undefined;
  static providerName = "mock";

  constructor(options: LLMOptions) {
    super(options);
    this.templateMessages = undefined;
    this.chatStreams = options.requestOptions?.extraBodyProperties?.chatStream;
  }

  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    yield this.completion;
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    if (this.chatStreams) {
      const chatStream =
        this.chatStreams?.[
          messages.filter((m) => m.role === "user" || m.role === "tool")
            .length - 1
        ];
      if (chatStream) {
        for (const message of chatStream) {
          switch (message) {
            case "REPEAT_LAST_MSG":
              yield {
                role: "assistant",
                content: messages[messages.length - 1].content,
              };
              break;
            case "REPEAT_SYSTEM_MSG":
              yield {
                role: "assistant",
                content:
                  messages.find((m) => m.role === "system")?.content || "",
              };
              break;
            case "ERROR":
              throw new Error("Intentional error");
            default:
              yield message;
          }
        }
      }
      return;
    }

    for (const char of this.completion) {
      yield {
        role: "assistant",
        content: char,
      };
    }
  }
}

export default MockLLM;
