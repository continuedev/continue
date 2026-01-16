import FormData from "form-data";
import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  TextMessagePart,
  Tool,
  ToolCallDelta,
} from "../../index.js";
import { BaseLLM } from "../index.js";

// Extended options for AskSage
interface AskSageCompletionOptions extends CompletionOptions {
  mode?: "chat" | "deep_agent";
  limitReferences?: 0 | 1;
  persona?: number;
  systemPrompt?: string;
  askSageTools?: AskSageTool[];
  enabledMcpTools?: string[];
  toolsToExecute?: string[];
  askSageToolChoice?: ToolChoice;
  reasoningEffort?: "low" | "medium" | "high";
  deepAgentId?: number;
  streaming?: boolean;
  file?: unknown;
}

const DEFAULT_API_URL = "https://api.asksage.ai/server";
const DEFAULT_USER_API_URL = "https://api.asksage.ai/user";
const TOKEN_TTL = 3600000; // 1 hour in milliseconds

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

interface AskSageRequestArgs {
  model?: string;
  temperature?: number;
  mode?: "chat" | "deep_agent";
  message?: string | { user: string; message: string }[];
  live?: 0 | 1 | 2;
  dataset?: string | string[];
  limit_references?: 0 | 1;
  persona?: number;
  system_prompt?: string;
  tools?: AskSageTool[];
  enabled_mcp_tools?: string[];
  tools_to_execute?: string[];
  tool_choice?: ToolChoice;
  reasoning_effort?: "low" | "medium" | "high";
  deep_agent_id?: number;
  streaming?: boolean;
  file?: unknown;
}

interface AskSageToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface AskSageResponse {
  text?: string;
  answer?: string;
  message?: string;
  status?: number | string;
  response?: unknown;
  tool_calls?: AskSageToolCall[];
  choices?: Array<{
    message?: {
      content?: string;
      tool_calls?: AskSageToolCall[];
    };
  }>;
}

interface TokenResponse {
  status: number | string;
  response: {
    access_token: string;
  };
}

class Asksage extends BaseLLM {
  static providerName = "askSage";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: DEFAULT_API_URL,
    model: "gpt-4o",
  };

  private sessionTokenPromise: Promise<string> | null = null;
  private tokenTimestamp: number = 0;
  private email?: string;
  private userApiUrl: string;

  constructor(options: LLMOptions) {
    super(options);
    this.apiVersion = options.apiVersion ?? "v1.2.4";
    this.email = process.env.ASKSAGE_EMAIL;
    this.userApiUrl = process.env.ASKSAGE_USER_API_URL || DEFAULT_USER_API_URL;
  }

  private async getSessionToken(): Promise<string> {
    if (!this.apiKey) {
      throw new Error(
        "AskSage adapter: missing ASKSAGE_API_KEY. Provide it in your environment variables or .env file.",
      );
    }

    // If no email, use API key directly
    if (!this.email || this.email.length === 0) {
      return this.apiKey;
    }

    const url = this.userApiUrl.replace(/\/$/, "") + "/get-token-with-api-key";
    const res = await this.fetch(url, {
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

  private async getToken(): Promise<string> {
    // Check if token needs refresh
    if (
      !this.sessionTokenPromise ||
      Date.now() - this.tokenTimestamp > TOKEN_TTL
    ) {
      this.sessionTokenPromise = this.getSessionToken();
      this.tokenTimestamp = Date.now();
    }
    return this.sessionTokenPromise;
  }

  private isFileLike(val: unknown): boolean {
    return (
      val !== null &&
      val !== undefined &&
      ((typeof File !== "undefined" && val instanceof File) ||
        (typeof Buffer !== "undefined" && val instanceof Buffer) ||
        (typeof val === "object" &&
          ("path" in val || "name" in val || "type" in val)))
    );
  }

  private toFormData(args: AskSageRequestArgs): FormData {
    const form = new FormData();

    for (const [key, value] of Object.entries(args)) {
      if (value === undefined || value === null) continue;

      if (key === "file" && value) {
        if (Buffer.isBuffer(value)) {
          form.append("file", value, "file");
        } else if (typeof value === "string") {
          form.append("file", value);
        } else {
          form.append("file", value as Buffer);
        }
      } else if (Array.isArray(value) || typeof value === "object") {
        form.append(key, JSON.stringify(value));
      } else {
        form.append(key, String(value));
      }
    }
    return form;
  }

  protected _convertMessage(message: ChatMessage) {
    return {
      user: message.role === "assistant" ? "gpt" : "me",
      message:
        typeof message.content === "string"
          ? message.content
          : message.content
              .filter((part) => part.type === "text")
              .map((part) => (part as TextMessagePart).text)
              .join(""),
    };
  }

  protected _convertToolToAskSageTool(tool: Tool): AskSageTool {
    return {
      type: tool.type,
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
      },
    };
  }

  protected _convertArgs(
    options: AskSageCompletionOptions,
    messages: ChatMessage[],
  ): AskSageRequestArgs {
    let formattedMessage: string | { user: string; message: string }[];
    if (messages.length === 1) {
      formattedMessage = messages[0].content as string;
    } else {
      formattedMessage = messages.map(this._convertMessage);
    }

    // Convert standard tools to AskSage format, or use askSageTools if provided
    const tools =
      options.tools?.map((tool) => this._convertToolToAskSageTool(tool)) ??
      options.askSageTools;

    // Map standard toolChoice to AskSage format, or use askSageToolChoice if provided
    const toolChoice = options.toolChoice ?? options.askSageToolChoice;

    const args: AskSageRequestArgs = {
      message: formattedMessage,
      model: options.model,
      temperature: options.temperature ?? 0.0,
      mode: "chat", // Always use chat mode
      limit_references: 0, // Always use 0
      persona: options.persona as number | undefined,
      system_prompt:
        options.systemPrompt ??
        process.env.ASKSAGE_SYSTEM_PROMPT ??
        "You are an expert software developer. You give helpful and concise responses.",
      tools,
      tool_choice: toolChoice,
      reasoning_effort: options.reasoningEffort as
        | "low"
        | "medium"
        | "high"
        | undefined,
      deep_agent_id: options.deepAgentId as number | undefined,
      streaming: options.streaming as boolean | undefined,
      file: options.file,
    };

    // Remove undefined values
    Object.keys(args).forEach(
      (key) =>
        args[key as keyof AskSageRequestArgs] === undefined &&
        delete args[key as keyof AskSageRequestArgs],
    );

    return args;
  }

  protected async _getHeaders(
    hasFile: boolean = false,
  ): Promise<Record<string, string>> {
    const token = await this.getToken();
    const headers: Record<string, string> = {
      accept: "application/json",
      "x-access-tokens": token,
    };

    if (!hasFile) {
      headers["Content-Type"] = "application/json";
    }

    return headers;
  }

  protected _getEndpoint(endpoint: string) {
    if (!this.apiBase) {
      throw new Error(
        "No API base URL provided. Please set the 'apiBase' option.",
      );
    }

    return new URL(endpoint, this.apiBase);
  }

  protected async _complete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): Promise<string> {
    if (typeof prompt !== "string" || prompt.trim() === "") {
      throw new Error("Prompt must be a non-empty string.");
    }

    const messages: ChatMessage[] = [{ role: "user", content: prompt }];
    const args = this._convertArgs(options, messages);
    const hasFile = this.isFileLike(args.file);
    const endpoint = hasFile ? "query_with_file" : "query";

    try {
      let response;
      if (hasFile) {
        const form = this.toFormData(args);
        const headers = await this._getHeaders(true);
        response = await this.fetch(this._getEndpoint(endpoint), {
          method: "POST",
          headers: {
            ...headers,
            ...form.getHeaders(),
          },
          body: form as unknown as BodyInit,
          signal,
        });
      } else {
        const headers = await this._getHeaders(false);
        response = await this.fetch(this._getEndpoint(endpoint), {
          method: "POST",
          headers,
          body: JSON.stringify(args),
          signal,
        });
      }

      if (response.status === 499) {
        return ""; // Aborted by user
      }

      if (!response.ok) {
        const errText = await response.text();

        // Clear token cache on 401
        if (response.status === 401) {
          this.sessionTokenPromise = null;
          this.tokenTimestamp = 0;
        }

        throw new Error(
          `AskSage API error: ${response.status} ${response.statusText}: ${errText}`,
        );
      }

      const data = (await response.json()) as AskSageResponse;
      return (
        data.text ||
        data.answer ||
        data.message ||
        data.choices?.[0]?.message?.content ||
        ""
      );
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`AskSage client error: ${error.message}`);
      }
      throw error;
    }
  }

  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const completion = await this._complete(prompt, signal, options);
    yield completion;
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const args = this._convertArgs(options, messages);
    const hasFile = this.isFileLike(args.file);
    const endpoint = hasFile ? "query_with_file" : "query";

    try {
      let response;
      if (hasFile) {
        const form = this.toFormData(args);
        const headers = await this._getHeaders(true);
        response = await this.fetch(this._getEndpoint(endpoint), {
          method: "POST",
          headers: {
            ...headers,
            ...form.getHeaders(),
          },
          body: form as unknown as BodyInit,
          signal,
        });
      } else {
        const headers = await this._getHeaders(false);
        response = await this.fetch(this._getEndpoint(endpoint), {
          method: "POST",
          headers,
          body: JSON.stringify(args),
          signal,
        });
      }

      if (response.status === 499) {
        return; // Aborted by user
      }

      if (!response.ok) {
        const errText = await response.text();

        // Clear token cache on 401
        if (response.status === 401) {
          this.sessionTokenPromise = null;
          this.tokenTimestamp = 0;
        }

        throw new Error(
          `AskSage API error: ${response.status} ${response.statusText}: ${errText}`,
        );
      }

      const data = (await response.json()) as AskSageResponse;

      // Extract tool calls from response (check both top-level and choices format)
      const rawToolCalls =
        data.tool_calls || data.choices?.[0]?.message?.tool_calls;

      // Convert to ToolCallDelta format if present
      const toolCalls: ToolCallDelta[] | undefined = rawToolCalls?.map(
        (tc) => ({
          id: tc.id,
          type: tc.type,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        }),
      );

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content:
          data.text ||
          data.answer ||
          data.message ||
          data.choices?.[0]?.message?.content ||
          "",
        ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
      };

      yield assistantMessage;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`AskSage client error: ${error.message}`);
      }
      throw error;
    }
  }

  async listModels(): Promise<string[]> {
    return [];
  }
}

export default Asksage;
