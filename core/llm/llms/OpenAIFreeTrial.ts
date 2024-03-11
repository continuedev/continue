import { BaseLLM } from "..";
import { ChatMessage, CompletionOptions, ModelProvider } from "../..";
import { streamResponse } from "../stream";

// const SERVER_URL = "http://localhost:8080";
const SERVER_URL = "https://proxy-server-l6vsfbzhba-uw.a.run.app";

class OpenAIFreeTrial extends BaseLLM {
  static providerName: ModelProvider = "openai-free-trial" as ModelProvider;

  private _getHeaders() {
    return {
      uniqueId: this.uniqueId || "None",
      "Content-Type": "application/json",
    };
  }

  protected async _complete(
    prompt: string,
    options: CompletionOptions,
  ): Promise<string> {
    const args = this.collectArgs(options);

    const response = await this.fetch(`${SERVER_URL}/complete`, {
      method: "POST",
      headers: this._getHeaders(),
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        ...args,
      }),
    });

    return await response.json();
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const args = this.collectArgs(options);

    const response = await this.fetch(`${SERVER_URL}/stream_complete`, {
      method: "POST",
      headers: this._getHeaders(),
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        ...args,
      }),
    });

    for await (const value of streamResponse(response)) {
      yield value;
    }
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions,
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

    for await (const value of streamResponse(response)) {
      const chunks = value.split("\n");

      for (const chunk of chunks) {
        if (chunk.trim() !== "") {
          const loadedChunk = JSON.parse(chunk);

          yield {
            role: "assistant",
            content: loadedChunk.content || "",
          };

          // if (this.model === "gpt-4") {
          //   await delay(0.03);
          // } else {
          //   await delay(0.01);
          // }
        }
      }
    }
  }
}

async function delay(seconds: number) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

export default OpenAIFreeTrial;
