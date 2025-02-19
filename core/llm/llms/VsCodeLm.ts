import { ChatMessage, CompletionOptions, LLMOptions, MessageContent, MessagePart } from "../../index.js";
import { BaseLLM } from "../index.js";

// Use require for VSCode API since it's a CommonJS module
const vscode = require('vscode');

class VscodeLm extends BaseLLM {
  static providerName = "vscode-lm";
  static defaultOptions: Partial<LLMOptions> = {
    model: "copilot/gpt-4o",
    completionOptions: {
      model: "copilot/gpt-4o",
      maxTokens: 128000, // 128k tokens - wont limit user here if they want to go under
    },
  };

  private client: any = null;
  private currentRequestCancellation: any = null;

  constructor(options: LLMOptions) {
    const model = options.model || VscodeLm.defaultOptions.model || "copilot/gpt-4o";
    super({
      ...VscodeLm.defaultOptions,
      ...options,
      model,
    });
    
    if (!model.startsWith("copilot/")) {
      console.warn(`Warning: Model ${model} is not a Copilot model. Some features may not work as expected.`);
    }
  }

  private async getClient() {
    if (!this.client) {
      try {
        const models = await vscode.lm.selectChatModels({
          id: this.model,
        });

        if (models && Array.isArray(models) && models.length > 0) {
          this.client = models[0];
        } else {
          throw new Error("No VSCode LM models available");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        throw new Error(`Failed to create VSCode LM client: ${message}`);
      }
    }
    return this.client;
  }

  private ensureCleanState(): void {
    if (this.currentRequestCancellation) {
      this.currentRequestCancellation.cancel();
      this.currentRequestCancellation.dispose();
      this.currentRequestCancellation = null;
    }
  }

  private continueMessageToString(content: MessageContent): string {
    if (typeof content === 'string') return content;
    return content.map((part: MessagePart) => {
      if ('text' in part) return part.text;
      if ('image_url' in part) return '';
      return '';
    }).join('');
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    try {
      this.ensureCleanState();
      const client = await this.getClient();

      // Convert messages to VSCode LM format
      const vsCodeMessages = messages.map((msg) => {
        const content = this.continueMessageToString(msg.content);
        return msg.role === "user" 
          ? vscode.LanguageModelChatMessage.User(content)
          : vscode.LanguageModelChatMessage.Assistant(content);
      });

      // Initialize cancellation token
      this.currentRequestCancellation = new vscode.CancellationTokenSource();

      // Send request with justification
      const response = await client.sendRequest(
        vsCodeMessages,
        {
          justification: `Continue would like to use '${client.name}' from '${client.vendor}'. Click 'Allow' to proceed.`,
        },
        this.currentRequestCancellation.token
      );

      // Stream the response
      for await (const chunk of response.stream) {
        if (chunk instanceof vscode.LanguageModelTextPart) {
          yield {
            role: "assistant",
            content: chunk.value,
          };
        }
      }
    } catch (error) {
      this.ensureCleanState();
      console.error("Error using VSCode LM:", error);
      throw error;
    }
  }

  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const chatGen = this._streamChat(
      [{ role: "user", content: prompt }],
      signal,
      options,
    );

    for await (const msg of chatGen) {
      yield this.continueMessageToString(msg.content);
    }
  }

  async listModels(): Promise<string[]> {
    return ["copilot/gpt-4o", "copilot/claude-3.5-sonnet"];
  }
}

export default VscodeLm; 