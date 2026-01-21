import { v4 as uuidv4 } from "uuid";
import {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageToolCall,
  Completion,
  CompletionCreateParamsNonStreaming,
  CompletionCreateParamsStreaming,
  CreateEmbeddingResponse,
  EmbeddingCreateParams,
  Model,
} from "openai/resources/index";
import { AskSageConfig } from "../types.js";
import { chatChunk, chatChunkFromDelta, customFetch } from "../util.js";
import {
  BaseLlmApi,
  CreateRerankResponse,
  FimCreateParamsStreaming,
  RerankCreateParams,
} from "./base.js";

const DEFAULT_API_URL = "https://api.asksage.ai/server";
const DEFAULT_USER_API_URL = "https://api.asksage.ai/user";
const TOKEN_TTL = 3600000; // 1 hour in milliseconds

/**
 * AskSage tool format (OpenAI-compatible)
 */
interface AskSageTool {
  type: string;
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

type ToolChoice =
  | "auto"
  | "none"
  | { type: "function"; function: { name: string } };

/**
 * AskSage API request body format
 */
interface AskSageRequestBody {
  message: string | Array<{ user: string; message: string }>;
  model: string;
  temperature?: number;
  mode?: "chat" | "deep_agent";
  limit_references?: 0 | 1;
  persona?: number;
  system_prompt?: string;
  tools?: AskSageTool[];
  tool_choice?: ToolChoice;
  reasoning_effort?: "low" | "medium" | "high";
  streaming?: boolean;
}

/**
 * AskSage API response format
 */
interface AskSageResponse {
  text?: string;
  answer?: string;
  message?: string;
  status?: number | string;
  response?: unknown;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
  choices?: Array<{
    message?: {
      content?: string;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
  }>;
}

interface TokenResponse {
  status: number | string;
  response: {
    access_token: string;
  };
}

export class AskSageApi implements BaseLlmApi {
  private apiBase: string;
  private userApiUrl: string;
  private apiKey?: string;
  private email?: string;
  private sessionTokenPromise: Promise<string> | null = null;
  private tokenTimestamp: number = 0;
  private fetchFn: typeof fetch;

  constructor(private config: AskSageConfig) {
    this.apiBase = config.apiBase ?? DEFAULT_API_URL;
    this.userApiUrl = config.env?.userApiUrl ?? DEFAULT_USER_API_URL;
    this.apiKey = config.apiKey;
    this.email = config.env?.email;
    this.fetchFn = customFetch(config.requestOptions);
  }

  /**
   * Get session token from API key + email, or use API key directly
   */
  private async getSessionToken(): Promise<string> {
    if (!this.apiKey) {
      throw new Error(
        "AskSage adapter: missing apiKey. Provide it in your configuration.",
      );
    }

    // If no email, use API key directly
    if (!this.email || this.email.length === 0) {
      return this.apiKey;
    }

    const url = this.userApiUrl.replace(/\/$/, "") + "/get-token-with-api-key";
    const res = await this.fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: this.email, api_key: this.apiKey }),
    });

    const data = (await res.json()) as TokenResponse;
    if (parseInt(String(data.status)) !== 200) {
      throw new Error("Error getting access token: " + JSON.stringify(data));
    }
    return data.response.access_token;
  }

  /**
   * Get cached token or refresh if expired
   */
  private async getToken(): Promise<string> {
    if (
      !this.sessionTokenPromise ||
      Date.now() - this.tokenTimestamp > TOKEN_TTL
    ) {
      this.sessionTokenPromise = this.getSessionToken();
      this.tokenTimestamp = Date.now();
      // Clear cache on failure so transient errors don't prevent retries
      this.sessionTokenPromise.catch(() => {
        this.clearTokenCache();
      });
    }
    return this.sessionTokenPromise;
  }

  /**
   * Clear token cache (e.g., on 401 errors)
   */
  private clearTokenCache(): void {
    this.sessionTokenPromise = null;
    this.tokenTimestamp = 0;
  }

  /**
   * Get request headers with auth token
   */
  private async getHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();
    return {
      accept: "application/json",
      "Content-Type": "application/json",
      "x-access-tokens": token,
    };
  }

  /**
   * Convert OpenAI messages to AskSage format
   */
  private convertMessages(
    messages: ChatCompletionCreateParamsNonStreaming["messages"],
  ): {
    systemPrompt?: string;
    messageArray: Array<{ user: string; message: string }>;
  } {
    let systemPrompt: string | undefined;
    const messageArray: Array<{ user: string; message: string }> = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        // Extract system message as system_prompt
        if (typeof msg.content === "string") {
          systemPrompt = msg.content;
        } else if (Array.isArray(msg.content)) {
          systemPrompt = msg.content
            .filter((p) => p.type === "text")
            .map((p) => (p as { type: "text"; text: string }).text)
            .join("\n");
        }
      } else if (msg.role === "user") {
        const content =
          typeof msg.content === "string"
            ? msg.content
            : Array.isArray(msg.content)
              ? msg.content
                  .filter((p) => p.type === "text")
                  .map((p) => (p as { type: "text"; text: string }).text)
                  .join("\n")
              : "";
        messageArray.push({ user: "me", message: content });
      } else if (msg.role === "assistant") {
        const content =
          typeof msg.content === "string"
            ? msg.content
            : Array.isArray(msg.content)
              ? msg.content
                  .filter((p) => p.type === "text")
                  .map((p) => (p as { type: "text"; text: string }).text)
                  .join("\n")
              : "";
        if (content) {
          messageArray.push({ user: "gpt", message: content });
        }
      } else if (msg.role === "tool") {
        // Include tool results as user messages
        const content =
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content);
        messageArray.push({
          user: "me",
          message: `Tool result for ${msg.tool_call_id}:\n${content}`,
        });
      }
    }

    return { systemPrompt, messageArray };
  }

  /**
   * Convert OpenAI tools to AskSage format
   */
  private convertTools(
    tools?: ChatCompletionCreateParamsNonStreaming["tools"],
  ): AskSageTool[] | undefined {
    if (!tools || tools.length === 0) {
      return undefined;
    }

    return tools.map((tool) => {
      if (tool.type === "function" && "function" in tool) {
        return {
          type: tool.type,
          function: {
            name: tool.function.name,
            description: tool.function.description,
            parameters: tool.function.parameters as Record<string, unknown>,
          },
        };
      }
      throw new Error(`Unsupported tool type: ${tool.type}`);
    });
  }

  /**
   * Convert OpenAI tool_choice to AskSage format
   */
  private convertToolChoice(
    toolChoice?: ChatCompletionCreateParamsNonStreaming["tool_choice"],
  ): ToolChoice | undefined {
    if (!toolChoice) {
      return undefined;
    }
    if (toolChoice === "auto" || toolChoice === "none") {
      return toolChoice;
    }
    if (typeof toolChoice === "object" && "function" in toolChoice) {
      return {
        type: "function",
        function: { name: toolChoice.function.name },
      };
    }
    return undefined;
  }

  /**
   * Build AskSage request body from OpenAI params
   */
  private buildRequestBody(
    body:
      | ChatCompletionCreateParamsNonStreaming
      | ChatCompletionCreateParamsStreaming,
  ): AskSageRequestBody {
    const { systemPrompt, messageArray } = this.convertMessages(body.messages);

    // If only one message and no system prompt needed in array format
    const message =
      messageArray.length === 1 && !systemPrompt
        ? messageArray[0].message
        : messageArray;

    const requestBody: AskSageRequestBody = {
      message,
      model: body.model,
      temperature: body.temperature ?? 0.0,
      mode: "chat",
      limit_references: 0,
    };

    if (systemPrompt) {
      requestBody.system_prompt = systemPrompt;
    }

    const tools = this.convertTools(body.tools);
    if (tools) {
      requestBody.tools = tools;
    }

    const toolChoice = this.convertToolChoice(body.tool_choice);
    if (toolChoice) {
      requestBody.tool_choice = toolChoice;
    }

    return requestBody;
  }

  /**
   * Parse AskSage response into OpenAI ChatCompletion format
   */
  private parseResponse(data: AskSageResponse, model: string): ChatCompletion {
    // Extract content from various response formats
    const content =
      data.text ||
      data.answer ||
      data.message ||
      data.choices?.[0]?.message?.content ||
      "";

    // Extract tool calls
    const rawToolCalls =
      data.tool_calls || data.choices?.[0]?.message?.tool_calls;

    const toolCalls: ChatCompletionMessageToolCall[] | undefined =
      rawToolCalls?.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }));

    return {
      id: uuidv4(),
      object: "chat.completion",
      model,
      created: Math.floor(Date.now() / 1000),
      choices: [
        {
          index: 0,
          logprobs: null,
          finish_reason:
            toolCalls && toolCalls.length > 0 ? "tool_calls" : "stop",
          message: {
            role: "assistant",
            content: content || null,
            tool_calls:
              toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
            refusal: null,
          },
        },
      ],
      usage: undefined,
    };
  }

  async chatCompletionNonStream(
    body: ChatCompletionCreateParamsNonStreaming,
    signal: AbortSignal,
  ): Promise<ChatCompletion> {
    const requestBody = this.buildRequestBody(body);
    const endpoint = `${this.apiBase.replace(/\/$/, "")}/query`;

    try {
      const headers = await this.getHeaders();
      const response = await this.fetchFn(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal,
      });

      if (!response.ok) {
        const errText = await response.text();

        // Clear token cache on 401
        if (response.status === 401) {
          this.clearTokenCache();
        }

        throw new Error(
          `AskSage API error: ${response.status} ${response.statusText}: ${errText}`,
        );
      }

      const data = (await response.json()) as AskSageResponse;
      return this.parseResponse(data, body.model);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`AskSage client error: ${error.message}`);
      }
      throw error;
    }
  }

  async *chatCompletionStream(
    body: ChatCompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk> {
    // AskSage API may not support true SSE streaming
    // Implement as non-streaming call that yields chunks
    const requestBody = this.buildRequestBody(body);
    const endpoint = `${this.apiBase.replace(/\/$/, "")}/query`;

    try {
      const headers = await this.getHeaders();
      const response = await this.fetchFn(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal,
      });

      if (!response.ok) {
        const errText = await response.text();

        if (response.status === 401) {
          this.clearTokenCache();
        }

        throw new Error(
          `AskSage API error: ${response.status} ${response.statusText}: ${errText}`,
        );
      }

      const data = (await response.json()) as AskSageResponse;

      // Extract content
      const content =
        data.text ||
        data.answer ||
        data.message ||
        data.choices?.[0]?.message?.content ||
        "";

      // Extract tool calls
      const rawToolCalls =
        data.tool_calls || data.choices?.[0]?.message?.tool_calls;

      // Yield content as a single chunk
      if (content) {
        yield chatChunk({
          content,
          model: body.model,
        });
      }

      // Yield tool calls if present
      if (rawToolCalls && rawToolCalls.length > 0) {
        for (let i = 0; i < rawToolCalls.length; i++) {
          const tc = rawToolCalls[i];
          yield chatChunkFromDelta({
            model: body.model,
            delta: {
              tool_calls: [
                {
                  index: i,
                  id: tc.id,
                  type: "function",
                  function: {
                    name: tc.function.name,
                    arguments: tc.function.arguments,
                  },
                },
              ],
            },
          });
        }
      }

      // Yield finish chunk
      yield chatChunk({
        content: null,
        model: body.model,
        finish_reason:
          rawToolCalls && rawToolCalls.length > 0 ? "tool_calls" : "stop",
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`AskSage client error: ${error.message}`);
      }
      throw error;
    }
  }

  completionNonStream(
    _body: CompletionCreateParamsNonStreaming,
    _signal: AbortSignal,
  ): Promise<Completion> {
    throw new Error("AskSage does not support legacy completions API");
  }

  completionStream(
    _body: CompletionCreateParamsStreaming,
    _signal: AbortSignal,
  ): AsyncGenerator<Completion> {
    throw new Error("AskSage does not support legacy completions API");
  }

  fimStream(
    _body: FimCreateParamsStreaming,
    _signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk> {
    throw new Error("AskSage does not support FIM");
  }

  async embed(_body: EmbeddingCreateParams): Promise<CreateEmbeddingResponse> {
    throw new Error("AskSage does not support embeddings");
  }

  async rerank(_body: RerankCreateParams): Promise<CreateRerankResponse> {
    throw new Error("AskSage does not support reranking");
  }

  async list(): Promise<Model[]> {
    // AskSage has a /get-models endpoint, but it requires authentication
    // For now, return empty array - models are typically configured explicitly
    return [];
  }
}
