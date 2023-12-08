import { LLM, LLMOptions } from "..";
import { ModelProvider } from "../../config";
import { ChatMessage, CompletionOptions } from "../types";

class TextGenWebUI extends LLM {
  static providerName: ModelProvider = "text-gen-webui";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "http://localhost:5000",
  };

  private _convertArgs(options: CompletionOptions, prompt: string) {
    const finalOptions = {
      prompt,
      ...options,
      max_new_tokens: options.maxTokens,
    };
    delete finalOptions.maxTokens;

    return finalOptions;
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions
  ): AsyncGenerator<string> {
    const streamingUrl =
      this.apiBase?.replace("5000", "5005") || "http://localhost:5005";

    const wsUrl = streamingUrl
      .replace("http://", "ws://")
      .replace("https://", "wss://");
    const payload = JSON.stringify({
      ...this._convertArgs(options, prompt),
      stream: true,
    });

    const websocket = new WebSocket(`${wsUrl}/api/v1/stream`);
    const messageQueue: string[] = [];
    let isDone = false;

    websocket.onopen = () => {
      websocket.send(payload);
    };

    websocket.onmessage = (event) => {
      const incomingData = JSON.parse(event.data);
      const incomingDataEvent = incomingData.event;

      if (incomingDataEvent === "text_stream") {
        messageQueue.push(incomingData.text);
      } else if (incomingDataEvent === "stream_end") {
        isDone = true;
      }
    };

    websocket.onerror = (error) => {
      isDone = true;
      throw error;
    };

    while (!isDone) {
      while (messageQueue.length > 0) {
        yield messageQueue.shift();
      }
      await new Promise((resolve) => setTimeout(resolve, 0)); // Don't block the event loop
    }
  }
}

export default TextGenWebUI;
