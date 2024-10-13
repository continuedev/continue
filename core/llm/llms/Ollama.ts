import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  ModelProvider,
} from "../../index.js";
import { stripImages } from "../images.js";
import { BaseLLM } from "../index.js";
import { streamResponse } from "../stream.js";

class Ollama extends BaseLLM {
  static providerName: ModelProvider = "ollama";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "http://localhost:11434/",
    model: "codellama-7b",
  };

  private fimSupported: boolean = false;

  constructor(options: LLMOptions) {
    super(options);

    if (options.model === "AUTODETECT") {
      return;
    }

    this.fetch(this.getEndpoint("api/show"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: this._getModel() }),
    })
      .then(async (response) => {
        if (response?.status !== 200) {
          // console.warn(
          //   "Error calling Ollama /api/show endpoint: ",
          //   await response.text(),
          // );
          return;
        }
        const body = await response.json();
        if (body.parameters) {
          const params = [];
          for (const line of body.parameters.split("\n")) {
            let parts = line.match(/^(\S+)\s+((?:".*")|\S+)$/);
            if (parts.length < 2) {
              continue;
            }
            let key = parts[1];
            let value = parts[2];
            switch (key) {
              case "num_ctx":
                this.contextLength =
                  options.contextLength ?? Number.parseInt(value);
                break;
              case "stop":
                if (!this.completionOptions.stop) {
                  this.completionOptions.stop = [];
                }
                try {
                  this.completionOptions.stop.push(JSON.parse(value));
                } catch (e) {
                  console.warn(
                    'Error parsing stop parameter value "{value}: ${e}',
                  );
                }
                break;
              default:
                break;
            }
          }
        }

        /**
         * There is no API to get the model's FIM capabilities, so we have to
         * make an educated guess. If a ".Suffix" variable appears in the template
         * it's a good indication the model supports FIM.
         */
        this.fimSupported = !!body?.template?.includes(".Suffix");
      })
      .catch((e) => {
        // console.warn("Error calling the Ollama /api/show endpoint: ", e);
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
        "llama3-8b": "llama3:8b",
        "llama3-70b": "llama3:70b",
        "llama3.1-8b": "llama3.1:8b",
        "llama3.1-70b": "llama3.1:70b",
        "llama3.1-405b": "llama3.1:405b",
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
        "starcoder2-3b": "starcoder2:3b",
        "stable-code-3b": "stable-code:3b",
        "granite-code-3b": "granite-code:3b",
        "granite-code-8b": "granite-code:8b",
        "granite-code-20b": "granite-code:20b",
        "granite-code-34b": "granite-code:34b",
      }[this.model] ?? this.model
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
    prompt: string | ChatMessage[],
    suffix?: string,
  ) {
    const finalOptions: any = {
      model: this._getModel(),
      raw: true,
      keep_alive: options.keepAlive ?? 60 * 30, // 30 minutes
      suffix,
      options: {
        temperature: options.temperature,
        top_p: options.topP,
        top_k: options.topK,
        num_predict: options.maxTokens,
        stop: options.stop,
        num_ctx: this.contextLength,
        mirostat: options.mirostat,
        num_thread: options.numThreads,
      },
    };

    if (typeof prompt === "string") {
      finalOptions.prompt = prompt;
    } else {
      finalOptions.messages = prompt.map(this._convertMessage);
    }

    return finalOptions;
  }

  private getEndpoint(endpoint: string): URL {
    let base = this.apiBase;
    if (process.env.IS_BINARY) {
      base = base?.replace("localhost", "127.0.0.1");
    }

    return new URL(endpoint, base);
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const response = await this.fetch(this.getEndpoint("api/generate"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(this._convertArgs(options, prompt)),
    });

    let buffer = "";
    for await (const value of streamResponse(response)) {
      // Append the received chunk to the buffer
      buffer += value;
      // Split the buffer into individual JSON chunks
      const chunks = buffer.split("\n");
      buffer = chunks.pop() ?? "";

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (chunk.trim() !== "") {
          try {
            const j = JSON.parse(chunk);
            if ("response" in j) {
              yield j.response;
            } else if ("error" in j) {
              throw new Error(j.error);
            }
          } catch (e) {
            throw new Error(`Error parsing Ollama response: ${e} ${chunk}`);
          }
        }
      }
    }
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const response = await this.fetch(this.getEndpoint("api/chat"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(this._convertArgs(options, messages)),
    });

    let buffer = "";
    for await (const value of streamResponse(response)) {
      // Append the received chunk to the buffer
      buffer += value;
      // Split the buffer into individual JSON chunks
      const chunks = buffer.split("\n");
      buffer = chunks.pop() ?? "";

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (chunk.trim() !== "") {
          try {
            const j = JSON.parse(chunk);
            if (j.message?.content) {
              yield {
                role: "assistant",
                content: j.message.content,
              };
            } else if (j.error) {
              throw new Error(j.error);
            }
          } catch (e) {
            throw new Error(`Error parsing Ollama response: ${e} ${chunk}`);
          }
        }
      }
    }
  }

  supportsFim(): boolean {
    return this.fimSupported;
  }

  protected async *_streamFim(
    prefix: string,
    suffix: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const response = await this.fetch(this.getEndpoint("api/generate"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(this._convertArgs(options, prefix, suffix)),
    });

    let buffer = "";
    for await (const value of streamResponse(response)) {
      // Append the received chunk to the buffer
      buffer += value;
      // Split the buffer into individual JSON chunks
      const chunks = buffer.split("\n");
      buffer = chunks.pop() ?? "";

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (chunk.trim() !== "") {
          try {
            const j = JSON.parse(chunk);
            if ("response" in j) {
              yield j.response;
            } else if ("error" in j) {
              throw new Error(j.error);
            }
          } catch (e) {
            throw new Error(`Error parsing Ollama response: ${e} ${chunk}`);
          }
        }
      }
    }
  }

  async listModels(): Promise<string[]> {
    const response = await this.fetch(
      // localhost was causing fetch failed in pkg binary only for this Ollama endpoint
      this.getEndpoint("api/tags"),
      {
        method: "GET",
      },
    );
    const data = await response.json();
    return data.models.map((model: any) => model.name);
  }
}

export default Ollama;
