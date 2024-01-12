import { BaseLLM } from "..";
import { ChatMessage, CompletionOptions, ModelProvider } from "../..";
import { streamResponse } from "../stream";

// const SERVER_URL = "http://localhost:3000";
const SERVER_URL = "https://node-proxy-server-l6vsfbzhba-uw.a.run.app";

class FreeTrial extends BaseLLM {
  static providerName: ModelProvider = "free-trial";

  private _getHeaders() {
    return {
      uniqueId: this.uniqueId || "None",
      "Content-Type": "application/json",
    };
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions
  ): AsyncGenerator<string> {
    const args = this.collectArgs(options);

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

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions
  ): AsyncGenerator<ChatMessage> {
    const args = this.collectArgs(options);

    const response = await this.fetch(`${SERVER_URL}/stream_chat`, {
      method: "POST",
      headers: this._getHeaders(),
      body: JSON.stringify({
        messages,
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
}

export default FreeTrial;
