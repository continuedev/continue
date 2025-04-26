/*
 * Databricks.ts — Continue LLM adapter for Databricks Model Serving
 *
 * This class extends the OpenAI base class to access Databricks Model Serving
 * endpoints. It loads the API key and endpoint URL from the user's
 * .continue/config.yaml (in their home directory) or from environment variables.
 * The configuration file should include an entry under "models" for provider "databricks".
 * Example YAML entry:
 *   models:
 *     - name: My Databricks Model
 *       provider: databricks
 *       model: my-model-1
 *       apiKey: YOUR_API_KEY
 *       endpoint: https://your-databricks-workspace-url
 *
 * If the endpoint is missing from the config, the code will attempt to fall back
 * to environment variables (DATABRICKS_ENDPOINT or DATABRICKS_URL). If no endpoint
 * is found, an error is thrown. All comments are in English.
 */
import OpenAI from "./OpenAI";
import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
} from "../../index";
import { fromChatCompletionChunk } from "../openaiTypeConverters";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as yaml from "js-yaml";

export default class Databricks extends OpenAI {
  static providerName = "databricks";

  /**
   * Load Databricks model configuration from .continue/config.yaml.
   * Looks for a model entry matching the given modelName with provider 'databricks'.
   * If found, returns an object with apiKey and endpoint (URL). Otherwise, falls back
   * to environment variables.
   * @param modelName The model identifier to match in the config.
   * @returns Object containing apiKey and endpoint (may be undefined if not found).
   */
  private static loadConfigFromYaml(modelName: string): { apiKey?: string; endpoint?: string } {
    // Determine path to ~/.continue/config.yaml
    const homeDir = os.homedir();
    const configPath = path.join(homeDir, ".continue", "config.yaml");
    try {
      if (fs.existsSync(configPath)) {
        const fileContents = fs.readFileSync(configPath, "utf8");
        const parsed = yaml.load(fileContents) as any;
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.models)) {
          // Find the model configuration for Databricks with matching model name
          const modelConfig = (parsed.models as any[]).find(
            (m) =>
              m.provider === "databricks" &&
              m.model === modelName
          );
          if (modelConfig && typeof modelConfig.apiKey === "string") {
            // Use endpoint if provided, else fallback to URL if any
            let endpointUrl: string | undefined;
            if (typeof modelConfig.endpoint === "string") {
              endpointUrl = modelConfig.endpoint;
            } else if (typeof modelConfig.url === "string") {
              endpointUrl = modelConfig.url;
            }
            // If endpoint is not present in config, try environment fallback
            if (!endpointUrl) {
              const envEndpoint = process.env.DATABRICKS_ENDPOINT || process.env.DATABRICKS_URL;
              if (typeof envEndpoint === "string") {
                endpointUrl = envEndpoint;
              }
            }
            return {
              apiKey: modelConfig.apiKey,
              endpoint: endpointUrl,
            };
          }
        }
      }
    } catch (error) {
      console.error("Error reading Databricks config.yaml:", error);
      // Proceed to fallback to environment variables
    }
    // Fallback to environment variables if config.yaml did not yield results
    const envApiKey = process.env.DATABRICKS_API_KEY || process.env.DATABRICKS_TOKEN;
    const envEndpoint = process.env.DATABRICKS_ENDPOINT || process.env.DATABRICKS_URL;
    return {
      apiKey: envApiKey,
      endpoint: envEndpoint,
    };
  }

  constructor(opts: LLMOptions) {
    // Ensure a model name is provided
    const modelName = opts.model;
    if (!modelName) {
      throw new Error("No model specified for Databricks. Please include a model name in the options.");
    }
    // Load configuration for this model from YAML or environment
    const config = Databricks.loadConfigFromYaml(modelName);
    // Validate that apiKey and endpoint are present
    if (!config.apiKey || !config.endpoint) {
      throw new Error(
        "Databricks connection information not found. Please configure 'apiKey' and 'endpoint' for the model in .continue/config.yaml or set the DATABRICKS_API_KEY and DATABRICKS_ENDPOINT environment variables."
      );
    }
    // Merge loaded credentials into options (allow overrides via opts)
    opts = {
      ...opts,
      apiKey: opts.apiKey ?? config.apiKey,
      apiBase: opts.apiBase ?? config.endpoint,
    };
    // Remove any trailing slashes from the apiBase URL
    opts.apiBase = (opts.apiBase ?? "").replace(/\/+$/, "");
    // Call the base class constructor with updated options
    super(opts);
  }

  /**
   * Generate the full URL for invoking the serving endpoint.
   * Example: https://adb-xxx.azuredatabricks.net/serving-endpoints/my-model/invocations
   * @returns The invocation URL as a string.
   */
  private getInvocationUrl(): string {
    return `${this.apiBase}/serving-endpoints/${this.model}/invocations`;
  }

  /**
   * Read Databricks streaming chat completion (SSE) and yield ChatMessages.
   * Converts the SSE data into OpenAI-style chat deltas.
   * @param msgs Initial chat history messages to send.
   * @param signal AbortSignal to cancel the request.
   * @param options Completion options like temperature, max_tokens, etc.
   */
  protected async *_streamChat(
    msgs: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    // Build request body using OpenAI conversion (chat format)
    const body: any = this._convertArgs(options, msgs);
    body.stream = true;
    // Send POST request to the invocation URL
    const res = await this.fetch(this.getInvocationUrl(), {
      method: "POST",
      headers: this._getHeaders(),
      body: JSON.stringify(body),
      signal,
    });
    // Check for HTTP errors or missing body
    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status}`);
    }
    const decoder = new TextDecoder();
    let buffer = "";
    /**
     * Parse the received buffer into SSE lines and extract messages.
     * @param str A string chunk of SSE data.
     * @returns Object with 'done' flag and array of ChatMessages.
     */
    const parseSSE = (
      str: string,
    ): { done: boolean; messages: ChatMessage[] } => {
      buffer += str;
      const out: ChatMessage[] = [];
      let idx: number;
      // Process each line in the buffer
      while ((idx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") {
          return { done: true, messages: out };
        }
        try {
          // Parse JSON and convert to chat message delta
          const json = JSON.parse(data);
          const delta = fromChatCompletionChunk(json);
          if (delta?.content) {
            out.push({ role: "assistant", content: delta.content });
          }
        } catch {
          // Ignore parse errors and wait for more data
        }
      }
      return { done: false, messages: out };
    };
    /*
     * WHATWG Streams reader (Node 18+ or browser)
     */
    if (typeof (res.body as any).getReader === "function") {
      const reader = (res.body as any).getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const { done: end, messages } = parseSSE(
          decoder.decode(value as Uint8Array, { stream: true }),
        );
        for (const m of messages) {
          yield m;
        }
        if (end) {
          return;
        }
      }
      return;
    }
    /*
     * Node.js Readable stream (Node 16 and below)
     */
    for await (const chunk of res.body as any) {
      const { done, messages } = parseSSE(
        decoder.decode(chunk as Buffer, { stream: true }),
      );
      for (const m of messages) {
        yield m;
      }
      if (done) {
        return;
      }
    }
  }
}
