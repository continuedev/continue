import { LLM, LLMOptions } from "..";
import { ModelProvider } from "../../config";
import OpenAIClient from "openai";
import { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions";
import { ChatMessage, CompletionOptions } from "../types";
class OpenAI extends LLM {
  static providerName: ModelProvider = "openai";

  private _openai: OpenAIClient;

  constructor(options: LLMOptions) {
    super(options);

    this._openai = new OpenAIClient({
      apiKey: this.apiKey,
      baseURL: this.apiBase,
      timeout: this.requestOptions?.timeout,
      defaultHeaders: this.requestOptions?.headers,
      dangerouslyAllowBrowser: true,
    });
  }

  protected _convertArgs(
    options: any,
    messages: ChatMessage[]
  ): ChatCompletionCreateParamsBase {
    const finalOptions: ChatCompletionCreateParamsBase = {
      messages,
      model: options.model,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      top_p: options.topP,
      frequency_penalty: options.frequencyPenalty,
      presence_penalty: options.presencePenalty,
      stop: options.stop,
    };

    return finalOptions;
  }

  protected async _complete(
    prompt: string,
    options: CompletionOptions
  ): Promise<string> {
    const response = await this._openai.chat.completions.create({
      ...this._convertArgs(options, [{ role: "user", content: prompt }]),
      stream: false,
    });

    return response.choices[0].message.content || "";
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions
  ): AsyncGenerator<string> {
    const response = await this._openai.chat.completions.create({
      ...this._convertArgs(options, [{ role: "user", content: prompt }]),
      stream: true,
    });

    for await (const message of response) {
      if (message.choices[0].delta.content) {
        yield message.choices[0].delta.content;
      }
    }
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions
  ): AsyncGenerator<ChatMessage> {
    const response = await this._openai.chat.completions.create({
      ...this._convertArgs(options, messages),
      stream: true,
    });

    for await (const message of response) {
      if (message.choices[0].delta.content) {
        yield { role: "assistant", content: message.choices[0].delta.content };
      }
    }
  }
}

export default OpenAI;
