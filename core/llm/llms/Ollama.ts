import * as ollama from "ollama";
import { BaseLLM } from "..";
import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  ModelProvider,
} from "../..";
import { stripImages } from "../countTokens";
import { streamResponse } from "../stream";

class Ollama extends BaseLLM {
  static providerName: ModelProvider = "ollama";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "http://localhost:11434",
    model: "codellama-7b",
  };

  constructor(options: LLMOptions) {
    super(options);

    if (options.model === "AUTODETECT") {
      return;
    }
    this.fetch(`${this.apiBase}/api/show`, {
      method: "POST",
      body: JSON.stringify({ name: this._getModel() }),
    }).then(async (response) => {
      if (response.status !== 200) {
        console.warn(
          "Error calling Ollama /api/show endpoint: ",
          await response.text()
        );
        return;
      }
      const body = await response.json();
      if (body.parameters) {
        const params = [];
        for (let line of body.parameters.split("\n")) {
          let parts = line.split(" ");
          if (parts.length < 2) {
            continue;
          }
          let key = parts[0];
          let value = parts[parts.length - 1];
          switch (key) {
            case "num_ctx":
              this.contextLength = parseInt(value);
              break;
            case "stop":
              if (!this.completionOptions.stop) {
                this.completionOptions.stop = [];
              }
              this.completionOptions.stop.push(value);
              break;
            default:
              break;
          }
        }
      }
    });
  }

  private _getModel() {
    return (
      {
        "mistral-7b": "mistral:7b",
        "mixtral-8x7b": "mixtral:8x7b",
        "llama2-7b": "llama2:7b",
        "llama2-13b": "llama2:13b",
        "codellama-7b": "codellama:7b",
        "codellama-13b": "codellama:13b",
        "codellama-34b": "codellama:34b",
        "codellama-70b": "codellama:70b",
        "phi-2": "phi:2.7b",
        "phind-codellama-34b": "phind-codellama:34b-v2",
        "wizardcoder-7b": "wizardcoder:7b-python",
        "wizardcoder-13b": "wizardcoder:13b-python",
        "wizardcoder-34b": "wizardcoder:34b-python",
        "zephyr-7b": "zephyr:7b",
        "codeup-13b": "codeup:13b",
        "deepseek-1b": "deepseek-coder:1.3b",
        "deepseek-7b": "deepseek-coder:6.7b",
        "deepseek-33b": "deepseek-coder:33b",
        "neural-chat-7b": "neural-chat:7b-v3.3",
        "starcoder-1b": "starcoder:1b",
        "starcoder-3b": "starcoder:3b",
        "stable-code-3b": "stable-code:3b",
      }[this.model] || this.model
    );
  }

  private _convertMessage(message: ChatMessage) {
    if (typeof message.content === "string") {
      return message;
    }

    return {
      role: message.role,
      content: stripImages(message.content),
      images: message.content
        .filter((part) => part.type === "imageUrl")
        .map((part) => part.imageUrl?.url.split(",").at(-1)),
    };
  }

  private _convertArgs(
    options: CompletionOptions,
    prompt: string | ChatMessage[]
  ) {
    const finalOptions: any = {
      model: this._getModel(),
      raw: true,
      keep_alive: 60 * 30, // 30 minutes
      options: {
        temperature: options.temperature,
        top_p: options.topP,
        top_k: options.topK,
        num_predict: options.maxTokens,
        stop: options.stop,
        num_ctx: this.contextLength,
        mirostat: options.mirostat,
      },
    };

    if (typeof prompt === "string") {
      finalOptions.prompt = prompt;
    } else {
      finalOptions.messages = prompt.map(this._convertMessage);
    }

    return finalOptions;
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions
  ): AsyncGenerator<string> {
    const response = await this.fetch(`${this.apiBase}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(this._convertArgs(options, prompt)),
    });

    let buffer = "";
    for await (const value of streamResponse(response)) {
      // Append the received chunk to the buffer
      buffer += value;
      // Split the buffer into individual JSON chunks
      const chunks = buffer.split("\n");

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (chunk.trim() !== "") {
          try {
            const j = JSON.parse(chunk);
            if ("response" in j) {
              yield j["response"];
            } else if ("error" in j) {
              throw new Error(j["error"]);
            }
          } catch (e) {
            throw new Error(`Error parsing Ollama response: ${e} ${chunk}`);
          }
        }
      }
      // Assign the last chunk to the buffer
      buffer = chunks[chunks.length - 1];
    }
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions
  ): AsyncGenerator<ChatMessage> {
    const client = new ollama.Ollama({
      host: this.apiBase,
    });
    const response = await client.chat({
      ...this._convertArgs(options, messages),
      stream: true,
    });

    try {
      for await (const chunk of response) {
        if (!chunk?.message?.content) continue;
        yield {
          role: "assistant",
          content: chunk.message.content,
        };
      }
    } finally {
      client.abort();
    }
  }

  async listModels(): Promise<string[]> {
    const response = await this.fetch(`${this.apiBase}/api/tags`, {
      method: "GET",
    });
    const data = await response.json();
    return data.models.map((model: any) => model.name);
  }
}

export default Ollama;
