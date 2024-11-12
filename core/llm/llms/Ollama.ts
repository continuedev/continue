import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  ModelProvider,
} from "../../index.js";
import { stripImages } from "../images.js";
import { BaseLLM } from "../index.js";
import { streamResponse } from "../stream.js";

interface OllamaChatMessage extends ChatMessage {
  images?: string[];
}

// See https://github.com/ollama/ollama/blob/main/docs/modelfile.md for details on each parameter
interface ModelFileParams {
  mirostat?: number;
  mirostat_eta?: number;
  mirostat_tau?: number;
  num_ctx?: number;
  repeat_last_n?: number;
  repeat_penalty?: number;
  temperature?: number;
  seed?: number;
  stop?: string | string[];
  tfs_z?: number;
  num_predict?: number;
  top_k?: number;
  top_p?: number;
  min_p?: number;
  // deprecated?
  num_thread?: number;
  use_mmap?: boolean;
  num_gqa?: number;
  num_gpu?: number;
}

// See https://github.com/ollama/ollama/blob/main/docs/api.md
interface BaseOptions {
  model: string; // the model name
  options?: ModelFileParams; // additional model parameters listed in the documentation for the Modelfile such as temperature
  format?: "json"; // the format to return a response in. Currently, the only accepted value is json
  stream?: boolean; // if false the response will be returned as a single response object, rather than a stream of objects
  keep_alive?: number; // controls how long the model will stay loaded into memory following the request (default: 5m)
}

interface GenerateOptions extends BaseOptions {
  prompt: string; // the prompt to generate a response for
  suffix?: string; // the text after the model response
  images?: string[]; // a list of base64-encoded images (for multimodal models such as llava)
  system?: string; // system message to (overrides what is defined in the Modelfile)
  template?: string; // the prompt template to use (overrides what is defined in the Modelfile)
  context?: string; // the context parameter returned from a previous request to /generate, this can be used to keep a short conversational memory
  raw?: boolean; // if true no formatting will be applied to the prompt. You may choose to use the raw parameter if you are specifying a full templated prompt in your request to the API
}

interface ChatOptions extends BaseOptions {
  messages: OllamaChatMessage[]; // the messages of the chat, this can be used to keep a chat memory
  // Not supported yet - tools: tools for the model to use if supported. Requires stream to be set to false
  // And correspondingly, tool calls in OllamaChatMessage
}

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
                    `Error parsing stop parameter value "{value}: ${e}`,
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
        "llama3.2-1b": "llama3.2:1b",
        "llama3.2-3b": "llama3.2:3b",
        "llama3.2-11b": "llama3.2:11b",
        "llama3.2-90b": "llama3.2:90b",
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

  private _getModelFileParams(options: CompletionOptions): ModelFileParams {
    return {
      temperature: options.temperature,
      top_p: options.topP,
      top_k: options.topK,
      num_predict: options.maxTokens,
      stop: options.stop,
      num_ctx: this.contextLength,
      mirostat: options.mirostat,
      num_thread: options.numThreads,
      use_mmap: options.useMmap,
      min_p: options.minP,
    };
  }

  private _convertMessage(message: ChatMessage) {
    if (typeof message.content === "string") {
      return message;
    }
    const images: string[] = [];
    message.content.forEach((part) => {
      if (part.type === "imageUrl" && part.imageUrl) {
        const image = part.imageUrl?.url.split(",").at(-1);
        if (image) {
          images.push(image);
        }
      }
    });

    return {
      role: message.role,
      content: stripImages(message.content),
      images,
    };
  }

  private _getChatOptions(
    options: CompletionOptions,
    messages: ChatMessage[],
  ): ChatOptions {
    return {
      model: this._getModel(),
      messages: messages.map(this._convertMessage),
      options: this._getModelFileParams(options),
      keep_alive: options.keepAlive ?? 60 * 30, // 30 minutes
      stream: options.stream,
      // format: options.format, // Not currently in base completion options
    };
  }

  private _getGenerateOptions(
    options: CompletionOptions,
    prompt: string,
    suffix?: string,
  ): GenerateOptions {
    return {
      model: this._getModel(),
      prompt,
      suffix,
      raw: options.raw,
      options: this._getModelFileParams(options),
      keep_alive: options.keepAlive ?? 60 * 30, // 30 minutes
      stream: options.stream,
      // Not supported yet: context, images, system, template, format
    };
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
      body: JSON.stringify(this._getGenerateOptions(options, prompt)),
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
      body: JSON.stringify(this._getChatOptions(options, messages)),
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
      body: JSON.stringify(this._getGenerateOptions(options, prefix, suffix)),
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
