import { LLM } from "..";
import { ModelProvider } from "../../config";
import { ChatMessage, CompletionOptions } from "../types";

// const SERVER_URL = "http://localhost:8080";
const SERVER_URL = "https://proxy-server-l6vsfbzhba-uw.a.run.app";

class FreeTrial extends LLM {
  static providerName: ModelProvider = "openai-free-trial";

  private _getHeaders() {
    return {
      uniqueId: this.uniqueId || "None",
      "Content-Type": "application/json",
    };
  }

  protected async _complete(
    prompt: string,
    options: CompletionOptions
  ): Promise<string> {
    const args = this.collectArgs(options);

    const response = await fetch(`${SERVER_URL}/complete`, {
      method: "POST",
      headers: this._getHeaders(),
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        ...args,
      }),
      //   proxy: this.requestOptions.proxy,
    });

    return await response.json();
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions
  ): AsyncGenerator<string> {
    const args = this.collectArgs(options);

    const response = await fetch(`${SERVER_URL}/stream_complete`, {
      method: "POST",
      headers: this._getHeaders(),
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        ...args,
      }),
    });

    const reader = response.body.getReader();
    let decoder = new TextDecoder("utf-8");

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        let decodedChunk = decoder.decode(value);
        yield decodedChunk;
      }
    }
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions
  ): AsyncGenerator<ChatMessage> {
    const args = this.collectArgs(options);

    const response = await fetch(`${SERVER_URL}/stream_chat`, {
      method: "POST",
      headers: this._getHeaders(),
      body: JSON.stringify({
        messages,
        ...args,
      }),
    });

    const reader = response.body.getReader();
    let decoder = new TextDecoder("utf-8");

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        let decodedChunk = decoder.decode(value);
        const chunks = decodedChunk.split("\n");

        for (const chunk of chunks) {
          if (chunk.trim() !== "") {
            const loadedChunk = JSON.parse(chunk);

            yield {
              role: "assistant",
              content: loadedChunk.content || "",
            };

            if (this.model === "gpt-4") {
              await delay(0.03);
            } else {
              await delay(0.01);
            }
          }
        }
      }
    }
  }
}

async function delay(seconds: number) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

export default FreeTrial;
