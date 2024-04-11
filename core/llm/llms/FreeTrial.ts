import { BaseLLM } from "..";
import { ChatMessage, CompletionOptions, ModelProvider } from "../..";
import { getHeaders } from "../../continueServer/stubs/headers";
import { SERVER_URL } from "../../util/parameters";
import { streamResponse } from "../stream";

class FreeTrial extends BaseLLM {
  static providerName: ModelProvider = "free-trial";

  private _getHeaders() {
    return {
      uniqueId: this.uniqueId || "None",
      "Content-Type": "application/json",
      ...getHeaders(),
    };
  }

  private _convertArgs(options: CompletionOptions): any {
    return {
      model: options.model,
      frequency_penalty: options.frequencyPenalty,
      presence_penalty: options.presencePenalty,
      max_tokens: options.maxTokens,
      stop:
        options.model === "starcoder-7b"
          ? options.stop
          : options.stop?.slice(0, 2),
      temperature: options.temperature,
      top_p: options.topP,
    };
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const args = this._convertArgs(this.collectArgs(options));

    const response = await this.fetch(`${SERVER_URL}/stream_complete`, {
      method: "POST",
      headers: this._getHeaders(),
      body: JSON.stringify({
        prompt,
        ...args,
      }),
    });

    for await (const value of streamResponse(response)) {
      yield value;
    }
  }

  protected _convertMessage(message: ChatMessage) {
    if (typeof message.content === "string") {
      return message;
    }

    const parts = message.content.map((part) => {
      return {
        type: part.type,
        text: part.text,
        image_url: { ...part.imageUrl, detail: "low" },
      };
    });
    return {
      ...message,
      content: parts,
    };
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const args = this._convertArgs(this.collectArgs(options));

    const response = await this.fetch(`${SERVER_URL}/stream_chat`, {
      method: "POST",
      headers: this._getHeaders(),
      body: JSON.stringify({
        messages: messages.map(this._convertMessage),
        ...args,
      }),
    });

    for await (const chunk of streamResponse(response)) {
      yield {
        role: "assistant",
        content: chunk,
      };
    }
  }

  async listModels(): Promise<string[]> {
    return [
      "gpt-3.5-turbo",
      "gpt-4",
      "gemini-pro",
      "gpt-4-vision-preview",
      "codellama-70b",
      "claude-3-opus-20240229",
      "claude-3-sonnet-20240229",
      "claude-3-haiku-20240307",
    ];
  }
}

export default FreeTrial;
