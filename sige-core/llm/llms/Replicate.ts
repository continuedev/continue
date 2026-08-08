import ReplicateClient from "replicate";

import { ChatMessage, CompletionOptions, LLMOptions } from "../../index.js";
import { renderChatMessage } from "../../util/messageContent.js";
import { BaseLLM } from "../index.js";

class Replicate extends BaseLLM {
  private static MODEL_IDS: {
    [name: string]: `${string}/${string}:${string}`;
  } = {
    "codellama-7b":
      "meta/codellama-7b-instruct:aac3ab196f8a75729aab9368cd45ea6ad3fc793b6cda93b1ded17299df369332",
    "codellama-13b":
      "meta/codellama-13b-instruct:a5e2d67630195a09b96932f5fa541fe64069c97d40cd0b69cdd91919987d0e7f",
    "codellama-34b":
      "meta/codellama-34b-instruct:eeb928567781f4e90d2aba57a51baef235de53f907c214a4ab42adabf5bb9736",
    "codellama-70b":
      "meta/codellama-70b-instruct:a279116fe47a0f65701a8817188601e2fe8f4b9e04a518789655ea7b995851bf",
    "llama2-7b": "meta/llama-2-7b-chat" as any,
    "llama2-13b": "meta/llama-2-13b-chat" as any,
    "llama3-8b": "meta/meta-llama-3-8b-instruct" as any,
    "llama3-70b": "meta/meta-llama-3-70b-instruct" as any,
    "llama3.1-8b": "meta/meta-llama-3.1-8b-instruct" as any,
    "llama3.1-70b": "meta/meta-llama-3.1-70b-instruct" as any,
    "llama3.1-405b": "meta/meta-llama-3.1-405b-instruct" as any,
    "zephyr-7b":
      "nateraw/zephyr-7b-beta:b79f33de5c6c4e34087d44eaea4a9d98ce5d3f3a09522f7328eea0685003a931",
    "mistral-7b":
      "mistralai/mistral-7b-instruct-v0.1:83b6a56e7c828e667f21fd596c338fd4f0039b46bcfa18d973e8e70e455fda70",
    "mistral-8x7b": "mistralai/mixtral-8x7b-instruct-v0.1" as any,
    "wizardcoder-34b":
      "andreasjansson/wizardcoder-python-34b-v1-gguf:67eed332a5389263b8ede41be3ee7dc119fa984e2bde287814c4abed19a45e54",
    "neural-chat-7b":
      "tomasmcm/neural-chat-7b-v3-1:acb450496b49e19a1e410b50c574a34acacd54820bc36c19cbfe05148de2ba57",
    "deepseek-7b": "kcaverly/deepseek-coder-33b-instruct-gguf" as any,
    "phind-codellama-34b": "kcaverly/phind-codellama-34b-v2-gguf" as any,
    "claude-4-sonnet-latest": "anthropic/claude-4-sonnet" as any,
  };

  static providerName = "replicate";
  private _replicate: ReplicateClient;

  private _convertArgs(
    options: CompletionOptions,
    prompt: string,
    signal: AbortSignal,
  ): [`${string}/${string}:${string}`, { input: any }] {
    return [
      Replicate.MODEL_IDS[options.model] || (options.model as any),
      {
        input: { prompt, message: prompt },
      },
    ];
  }

  private _convertChatArgs(
    options: CompletionOptions,
    messages: ChatMessage[],
    signal: AbortSignal,
  ): [`${string}/${string}:${string}`, { input: any }] {
    let prompt = "";
    let system_prompt = "";

    for (const message of messages) {
      const content =
        typeof message.content === "string"
          ? message.content
          : renderChatMessage(message);

      if (message.role === "system") {
        system_prompt += `System: ${content}\n\n`;
      } else if (message.role === "user") {
        prompt += `Human: ${content}\n\n`;
      } else if (message.role === "assistant") {
        prompt += `Assistant: ${content}\n\n`;
      }
    }

    if (!prompt.endsWith("Assistant: ")) {
      prompt += "Assistant: ";
    }

    // Construct the input
    const input: any = {
      prompt: prompt,
      system_prompt: system_prompt,
      max_tokens: options.maxTokens || 2048,
      extended_thinking: options.reasoning,
      thinking_budget_tokens: options.reasoningBudgetTokens || 1024,
    };

    return [
      Replicate.MODEL_IDS[options.model] || (options.model as any),
      {
        input,
      },
    ];
  }

  constructor(options: LLMOptions) {
    super(options);
    this._replicate = new ReplicateClient({ auth: options.apiKey });
  }

  protected async _complete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): Promise<string> {
    const [model, args] = this._convertArgs(options, prompt, signal);
    const response = await this._replicate.run(model, args);

    return (response as any)[0];
  }

  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const [model, args] = this._convertArgs(options, prompt, signal);
    for await (const event of this._replicate.stream(model, args)) {
      if (event.event === "output") {
        yield event.data;
      }
    }
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    if (!this.apiKey || this.apiKey === "") {
      throw new Error("You need to use an API key");
    }

    const [model, args] = this._convertChatArgs(options, messages, signal);

    try {
      for await (const event of this._replicate.stream(model, args)) {
        if (event.event === "output") {
          yield {
            role: "assistant",
            content: event.data,
          };
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("authentication")) {
          throw new Error(
            "Replicate API authentication failed. Please check your API key",
          );
        }
        if (error.message.includes("model not found")) {
          throw new Error(
            `Model "${options.model}" not found on Replicate. Please check the model name or use another model.`,
          );
        }
      }
      throw error;
    }
  }
}

export default Replicate;
