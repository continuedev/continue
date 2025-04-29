import { Mutex } from "async-mutex";
import { JSONSchema7, JSONSchema7Object } from "json-schema";

import {
  ChatMessage,
  ChatMessageRole,
  CompletionOptions,
  LLMOptions,
  ModelInstaller,
} from "../../index.js";
import { renderChatMessage } from "../../util/messageContent.js";
import { getRemoteModelInfo } from "../../util/ollamaHelper.js";
import { BaseLLM } from "../index.js";
import { streamResponse } from "../stream.js";

type OllamaChatMessage = {
  role: ChatMessageRole;
  content: string;
  images?: string[] | null;
  tool_calls?: {
    function: {
      name: string;
      arguments: JSONSchema7Object;
    };
  }[];
};

// See https://github.com/ollama/ollama/blob/main/docs/modelfile.md for details on each parameter
interface OllamaModelFileParams {
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

  // deprecated or not directly supported here:
  num_thread?: number;
  use_mmap?: boolean;
  num_gqa?: number;
  num_gpu?: number;
  num_keep?: number;
  typical_p?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  penalize_newline?: boolean;
  numa?: boolean;
  num_batch?: number;
  main_gpu?: number;
  low_vram?: boolean;
  vocab_only?: boolean;
  use_mlock?: boolean;
}

// See https://github.com/ollama/ollama/blob/main/docs/api.md
interface OllamaBaseOptions {
  model: string; // the model name
  options?: OllamaModelFileParams; // additional model parameters listed in the documentation for the Modelfile such as temperature
  format?: "json"; // the format to return a response in. Currently, the only accepted value is json
  stream?: boolean; // if false the response will be returned as a single response object, rather than a stream of objects
  keep_alive?: number; // controls how long the model will stay loaded into memory following the request (default: 5m)
}

interface OllamaRawOptions extends OllamaBaseOptions {
  prompt: string; // the prompt to generate a response for
  suffix?: string; // the text after the model response
  images?: string[]; // a list of base64-encoded images (for multimodal models such as llava)
  system?: string; // system message to (overrides what is defined in the Modelfile)
  template?: string; // the prompt template to use (overrides what is defined in the Modelfile)
  context?: string; // the context parameter returned from a previous request to /generate, this can be used to keep a short conversational memory
  raw?: boolean; // if true no formatting will be applied to the prompt. You may choose to use the raw parameter if you are specifying a full templated prompt in your request to the API
}

interface OllamaChatOptions extends OllamaBaseOptions {
  messages: OllamaChatMessage[]; // the messages of the chat, this can be used to keep a chat memory
  tools?: OllamaTool[]; // the tools of the chat, this can be used to keep a tool memory
  // Not supported yet - tools: tools for the model to use if supported. Requires stream to be set to false
  // And correspondingly, tool calls in OllamaChatMessage
}

type OllamaBaseResponse = {
  model: string;
  created_at: string;
} & (
    | {
      done: false;
    }
    | {
      done: true;
      done_reason: string;
      total_duration: number; // Time spent generating the response in nanoseconds
      load_duration: number; // Time spent loading the model in nanoseconds
      prompt_eval_count: number; // Number of tokens in the prompt
      prompt_eval_duration: number; // Time spent evaluating the prompt in nanoseconds
      eval_count: number; // Number of tokens in the response
      eval_duration: number; // Time spent generating the response in nanoseconds
      context: number[]; // An encoding of the conversation used in this response; can be sent in the next request to keep conversational memory
    }
  );

type OllamaErrorResponse = {
  error: string;
};

type OllamaRawResponse =
  | OllamaErrorResponse
  | (OllamaBaseResponse & {
    response: string; // the generated response
  });

type OllamaChatResponse =
  | OllamaErrorResponse
  | (OllamaBaseResponse & {
    message: OllamaChatMessage;
  });

interface OllamaTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: JSONSchema7;
  };
}

class Ollama extends BaseLLM implements ModelInstaller {
  static providerName = "ollama";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "http://localhost:11434/",
    model: "codellama-7b",
    maxEmbeddingBatchSize: 64,
  };

  private static modelsBeingInstalled: Set<string> = new Set();
  private static modelsBeingInstalledMutex = new Mutex();

  private fimSupported: boolean = false;

  constructor(options: LLMOptions) {
    super(options);

    if (options.model === "AUTODETECT") {
      return;
    }
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    this.fetch(this.getEndpoint("api/show"), {
      method: "POST",
      headers: headers,
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

  // Map of "continue model name" to Ollama actual model name
  private modelMap: Record<string, string> = {
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
    "qwen2.5-coder-0.5b": "qwen2.5-coder:0.5b",
    "qwen2.5-coder-1.5b": "qwen2.5-coder:1.5b",
    "qwen2.5-coder-3b": "qwen2.5-coder:3b",
    "qwen2.5-coder-7b": "qwen2.5-coder:7b",
    "qwen2.5-coder-14b": "qwen2.5-coder:14b",
    "qwen2.5-coder-32b": "qwen2.5-coder:32b",
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
  };

  private _getModel() {
    return this.modelMap[this.model] ?? this.model;
  }

  private _getModelFileParams(
    options: CompletionOptions,
  ): OllamaModelFileParams {
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

  private _convertToOllamaMessage(message: ChatMessage): OllamaChatMessage {
    const ollamaMessage: OllamaChatMessage = {
      role: message.role,
      content: "",
    };

    ollamaMessage.content = renderChatMessage(message);
    if (Array.isArray(message.content)) {
      const images: string[] = [];
      message.content.forEach((part) => {
        if (part.type === "imageUrl" && part.imageUrl) {
          const image = part.imageUrl?.url.split(",").at(-1);
          if (image) {
            images.push(image);
          }
        }
      });
      if (images.length > 0) {
        ollamaMessage.images = images;
      }
    }

    return ollamaMessage;
  }

  private _getGenerateOptions(
    options: CompletionOptions,
    prompt: string,
    suffix?: string,
  ): OllamaRawOptions {
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
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    const response = await this.fetch(this.getEndpoint("api/generate"), {
      method: "POST",
      headers: headers,
      body: JSON.stringify(this._getGenerateOptions(options, prompt)),
      signal,
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
            const j = JSON.parse(chunk) as OllamaRawResponse;
            if ("error" in j) {
              throw new Error(j.error);
            }
            j.response ??= ''
            yield j.response;
          } catch (e) {
            throw new Error(`Error parsing Ollama response: ${e} ${chunk}`);
          }
        }
      }
    }
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const ollamaMessages = messages.map(this._convertToOllamaMessage);
    const chatOptions: OllamaChatOptions = {
      model: this._getModel(),
      messages: ollamaMessages,
      options: this._getModelFileParams(options),
      keep_alive: options.keepAlive ?? 60 * 30, // 30 minutes
      stream: options.stream,
      // format: options.format, // Not currently in base completion options
    };
    // This logic is because tools can ONLY be included with user message for ollama
    if (options.tools?.length && ollamaMessages.at(-1)?.role === "user") {
      chatOptions.tools = options.tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters,
        },
      }));
      chatOptions.stream = false; // Cannot set stream = true for tools calls
    }
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    const response = await this.fetch(this.getEndpoint("api/chat"), {
      method: "POST",
      headers: headers,
      body: JSON.stringify(chatOptions),
      signal,
    });

    function convertChatMessage(res: OllamaChatResponse): ChatMessage {
      if ("error" in res) {
        throw new Error(res.error);
      }
      if (res.message.role === "tool") {
        throw new Error(
          "Unexpected message received from ollama with role = tool",
        );
      }
      if (res.message.role === "assistant") {
        const chatMessage: ChatMessage = {
          role: "assistant",
          content: res.message.content,
        };
        if (res.message.tool_calls) {
          // Continue handles the response as a tool call delta but
          // But ollama returns the full object in one response with no streaming
          chatMessage.toolCalls = res.message.tool_calls.map((tc) => ({
            type: "function",
            function: {
              name: tc.function.name,
              arguments: JSON.stringify(tc.function.arguments),
            },
          }));
        }
        return chatMessage;
      } else {
        return {
          role: res.message.role,
          content: res.message.content,
        };
      }
    }

    if (chatOptions.stream === false) {
      const json = (await response.json()) as OllamaChatResponse;
      yield convertChatMessage(json);
    } else {
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
              const j = JSON.parse(chunk) as OllamaChatResponse;
              const chatMessage = convertChatMessage(j);
              yield chatMessage;
            } catch (e) {
              throw new Error(`Error parsing Ollama response: ${e} ${chunk}`);
            }
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
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    const response = await this.fetch(this.getEndpoint("api/generate"), {
      method: "POST",
      headers: headers,
      body: JSON.stringify(this._getGenerateOptions(options, prefix, suffix)),
      signal,
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
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    const response = await this.fetch(
      // localhost was causing fetch failed in pkg binary only for this Ollama endpoint
      this.getEndpoint("api/tags"),
      {
        method: "GET",
        headers: headers,
      },
    );
    const data = await response.json();
    if (response.ok) {
      return data.models.map((model: any) => model.name);
    } else {
      throw new Error(
        "Failed to list Ollama models. Make sure Ollama is running.",
      );
    }
  }

  protected async _embed(chunks: string[]): Promise<number[][]> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    const resp = await this.fetch(new URL("api/embed", this.apiBase), {
      method: "POST",
      body: JSON.stringify({
        model: this.model,
        input: chunks,
      }),
      headers: headers,
    });

    if (!resp.ok) {
      throw new Error(`Failed to embed chunk: ${await resp.text()}`);
    }

    const data = await resp.json();
    const embedding: number[][] = data.embeddings;

    if (!embedding || embedding.length === 0) {
      throw new Error("Ollama generated empty embedding");
    }
    return embedding;
  }

  public async installModel(
    modelName: string,
    signal: AbortSignal,
    progressReporter?: (task: string, increment: number, total: number) => void,
  ): Promise<any> {
    const modelInfo = await getRemoteModelInfo(modelName, signal);
    if (!modelInfo) {
      throw new Error(`'${modelName}' not found in the Ollama registry!`);
    }

    const release = await Ollama.modelsBeingInstalledMutex.acquire();
    try {
      if (Ollama.modelsBeingInstalled.has(modelName)) {
        throw new Error(`Model '${modelName}' is already being installed.`);
      }
      Ollama.modelsBeingInstalled.add(modelName);
    } finally {
      release();
    }

    try {
      const response = await fetch(this.getEndpoint("api/pull"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ name: modelName }),
        signal,
      });

      const reader = response.body?.getReader();
      //TODO: generate proper progress based on modelInfo size
      while (true) {
        const { done, value } = (await reader?.read()) || {
          done: true,
          value: undefined,
        };
        if (done) {
          break;
        }

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split("\n").filter(Boolean);
        for (const line of lines) {
          const data = JSON.parse(line);
          progressReporter?.(data.status, data.completed, data.total);
        }
      }
    } finally {
      const release = await Ollama.modelsBeingInstalledMutex.acquire();
      try {
        Ollama.modelsBeingInstalled.delete(modelName);
      } finally {
        release();
      }
    }
  }

  public async isInstallingModel(modelName: string): Promise<boolean> {
    const release = await Ollama.modelsBeingInstalledMutex.acquire();
    try {
      return Ollama.modelsBeingInstalled.has(modelName);
    } finally {
      release();
    }
  }
}

export default Ollama;
