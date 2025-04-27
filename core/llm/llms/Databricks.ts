/*
 * Databricks.ts — Continue LLM adapter for Databricks Model Serving
 * Copyright (c) 2025
 *
 * Required configuration:
 *   - API Token: Personal Access Token (PAT)
 *   - Base URL: Workspace URL (e.g., https://adb-xxxx.azuredatabricks.net)
 *
 * This class extends the OpenAI base class to access Databricks Serving Endpoints
 * via Streaming Chat Completions (SSE).
 */
import OpenAI from "./OpenAI";
import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
} from "../../index";
import { fromChatCompletionChunk } from "../openaiTypeConverters";
import { renderChatMessage, stripImages } from "../../util/messageContent";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as yaml from "js-yaml";

export default class Databricks extends OpenAI {
  static providerName = "databricks";
  private modelConfig: any = null;

  /**
   * Load Databricks model configuration from .continue/config.yaml.
   * Reads all available configuration options for the specified model.
   * @param modelName The model identifier to match in the config.
   * @returns Complete model configuration object including all options.
   */
  private static loadConfigFromYaml(modelName: string): any {
    console.log("Attempting to load config from YAML for model:", modelName);
    
    // Determine path to ~/.continue/config.yaml
    const homeDir = os.homedir();
    const configPath = path.join(homeDir, ".continue", "config.yaml");
    console.log("Looking for config file at:", configPath);
    
    try {
      if (fs.existsSync(configPath)) {
        console.log("Config file exists, reading content");
        const fileContents = fs.readFileSync(configPath, "utf8");
        const parsed = yaml.load(fileContents) as any;
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.models)) {
          console.log(`Found ${parsed.models.length} models in config`);
          
          // Find the model configuration for Databricks with matching model name
          const modelConfig = (parsed.models as any[]).find(
            (m) =>
              m.provider === "databricks" &&
              m.model === modelName
          );
          
          if (modelConfig) {
            console.log("Found matching model config:", {
              name: modelConfig.name,
              provider: modelConfig.provider,
              model: modelConfig.model,
              hasApiKey: !!modelConfig.apiKey,
              hasApiBase: !!modelConfig.apiBase,
              hasDefaultCompletionOptions: !!modelConfig.defaultCompletionOptions
            });
            
            if (modelConfig && typeof modelConfig.apiKey === "string" && typeof modelConfig.apiBase === "string") {
              // Return the complete model configuration
              return modelConfig;
            }
          } else {
            console.log(`No model with name '${modelName}' and provider 'databricks' found in config`);
          }
        }
      } else {
        console.log("Config file not found at path:", configPath);
      }
    } catch (error) {
      console.error("Error reading Databricks config.yaml:", error);
    }
    
    // If config.yaml did not yield results, fall back to environment variables
    console.log("Trying environment variables as fallback");
    const pat = process.env.DATABRICKS_TOKEN;
    const base = process.env.YOUR_DATABRICKS_URL;
    if (pat && base) {
      console.log("Found environment variables, using them instead");
      return {
        apiKey: pat,
        apiBase: base,
      };
    }
    
    console.log("No configuration found in YAML or environment variables");
    // If neither config.yaml nor environment variables worked, throw error
    throw new Error(
      "Databricks connection information not found. Please configure 'apiKey' and 'apiBase' for the model in .continue/config.yaml."
    );
  }

  constructor(opts: LLMOptions) {
    console.log("Databricks constructor called with model:", opts.model);
    
    // Ensure a model name is provided
    const modelName = opts.model;
    if (!modelName) {
      throw new Error("No model specified for Databricks. Please include a model name in the options.");
    }
    
    // Load complete configuration for this model from YAML
    console.log("Loading config for model:", modelName);
    const modelConfig = Databricks.loadConfigFromYaml(modelName);
    console.log("Loaded config:", { 
      apiKeyExists: !!modelConfig.apiKey, 
      endpoint: modelConfig.apiBase,
      defaultCompletionOptionsExist: !!modelConfig.defaultCompletionOptions
    });
    
    // Validate that apiKey and endpoint are present
    if (!modelConfig.apiKey || !modelConfig.apiBase) {
      throw new Error(
        "Databricks connection information not found. Please configure 'apiKey' and 'apiBase' for the model in .continue/config.yaml."
      );
    }
    
    // Merge loaded credentials into options (allow overrides via opts)
    opts = {
      ...opts,
      apiKey: opts.apiKey ?? modelConfig.apiKey,
      apiBase: opts.apiBase ?? modelConfig.apiBase,
    };
    
    // Remove any trailing slashes from the apiBase URL
    opts.apiBase = (opts.apiBase ?? "").replace(/\/+$/, "");
    console.log("Final apiBase after processing:", opts.apiBase);
    
    // Call the base class constructor with updated options
    // Important: super() must be called before accessing 'this'
    super(opts);
    
    // Store model config for later use in parameter conversion
    // This must be done after the super() call
    this.modelConfig = modelConfig;
  }

  /**
   * Generate the full URL for invoking the serving endpoint.
   * For config compatibility, returns the apiBase directly since it already contains
   * the full path including /serving-endpoints/{model}/invocations
   * @returns The invocation URL as a string.
   */
  private getInvocationUrl(): string {
    const url = (this.apiBase ?? "").replace(/\/+$/, "");
    console.log("Databricks adapter using URL:", url);
    return url;
  }

  /**
   * Convert CompletionOptions to Databricks API parameters.
   * @param options CompletionOptions to convert
   * @returns Converted parameters for Databricks API
   */
  private convertArgs(options: CompletionOptions): any {
    console.log("Converting args with options:", {
      temperature: options.temperature,
      topP: options.topP,
      topK: options.topK,
      maxTokens: options.maxTokens,
      reasoning: options.reasoning,
      reasoningBudgetTokens: options.reasoningBudgetTokens,
      presencePenalty: options.presencePenalty,
      frequencyPenalty: options.frequencyPenalty,
      stop: options.stop,
      stream: options.stream
    });
    
    // Determine thinking mode configuration
    let thinkingConfig = undefined;
    if (options.reasoning) {
      thinkingConfig = {
        type: "enabled",
        budget_tokens: options.reasoningBudgetTokens || 4000
      };
      console.log("Enabling thinking mode with config:", thinkingConfig);
    } else if (this.modelConfig?.defaultCompletionOptions?.thinking) {
      // Use thinking mode from config if available
      thinkingConfig = this.modelConfig.defaultCompletionOptions.thinking;
      console.log("Using thinking config from config.yaml:", thinkingConfig);
    }
    
    // Build parameters object
    const finalOptions = {
      model: options.model || this.modelConfig?.model,
      temperature: options.temperature ?? this.modelConfig?.defaultCompletionOptions?.temperature ?? 0.7,
      top_p: options.topP ?? this.modelConfig?.defaultCompletionOptions?.topP ?? 0.95,
      top_k: options.topK ?? this.modelConfig?.defaultCompletionOptions?.topK ?? 100,
      max_tokens: options.maxTokens ?? this.modelConfig?.defaultCompletionOptions?.maxTokens ?? 4096,
      presence_penalty: options.presencePenalty ?? this.modelConfig?.defaultCompletionOptions?.presencePenalty ?? 0,
      frequency_penalty: options.frequencyPenalty ?? this.modelConfig?.defaultCompletionOptions?.frequencyPenalty ?? 0,
      stop_sequences: options.stop?.filter(x => x.trim() !== "") ?? this.modelConfig?.defaultCompletionOptions?.stop ?? [],
      stream: options.stream ?? this.modelConfig?.defaultCompletionOptions?.stream ?? true,
      thinking: thinkingConfig,
    };
    
    // Log the final parameters being sent
    console.log("Final API parameters:", JSON.stringify(finalOptions, null, 2));
    
    return finalOptions;
  }

  /**
   * Convert messages to Databricks API format.
   * This method only processes the actual message content and returns an array
   * as expected by the OpenAI base class.
   * System messages are handled separately by extractSystemMessage().
   * 
   * @param msgs Array of ChatMessage objects
   * @returns Array of messages formatted for Databricks API
   */
  private convertMessages(msgs: ChatMessage[]): any[] {
    console.log(`Converting ${msgs.length} messages to Databricks format`);
    
    // Filter out system messages as they're handled separately
    const filteredMessages = msgs.filter(
      (m) => m.role !== "system" && !!m.content
    );
    
    // Convert remaining messages to Databricks format
    const messages = filteredMessages.map((message) => {
      if (typeof message.content === "string") {
        return {
          role: message.role === "user" ? "user" : "assistant",
          content: message.content
        };
      } else {
        // Handle messages with complex content (like images)
        console.log("Converting complex message content");
        return {
          role: message.role === "user" ? "user" : "assistant",
          content: message.content
        };
      }
    });
    
    console.log(`Converted to ${messages.length} messages`);
    return messages;
  }

  /**
   * Extract system message from the messages array.
   * @param msgs Array of ChatMessage objects
   * @returns Extracted system message or undefined if not present
   */
  private extractSystemMessage(msgs: ChatMessage[]): string | undefined {
    const systemMessage = stripImages(
      msgs.filter((m) => m.role === "system")[0]?.content ?? ""
    );
    
    if (systemMessage) {
      console.log("Found system message, length:", systemMessage.length);
      return systemMessage;
    }
    
    return undefined;
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
    console.log("_streamChat called with messages length:", msgs.length);
    
    // Convert messages and extract system message
    const convertedMessages = this.convertMessages(msgs);
    const systemMessage = this.extractSystemMessage(msgs);
    
    // Build request body
    const body = {
      ...this.convertArgs(options),
      messages: convertedMessages,
      system: systemMessage
    };
    
    // Enable streaming
    body.stream = true;
    
    // Log the final request body (sanitized for security)
    const sanitizedBody = { ...body };
    if (body.messages) {
      sanitizedBody.messages = `[${convertedMessages.length} messages]`;
    }
    console.log("Sending request with body:", JSON.stringify(sanitizedBody, null, 2));
    
    // Send POST request to the invocation URL
    const invocationUrl = this.getInvocationUrl();
    console.log("Sending request to:", invocationUrl);
    
    try {
      const res = await this.fetch(invocationUrl, {
        method: "POST",
        headers: this._getHeaders(),
        body: JSON.stringify(body),
        signal,
      });
      
      console.log("Response status:", res.status);
      
      // Check for HTTP errors or missing body
      if (!res.ok || !res.body) {
        console.error("HTTP error response:", res.status, res.statusText);
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
            console.log("Received [DONE] marker");
            return { done: true, messages: out };
          }
          try {
            // Parse JSON and convert to chat message delta
            const json = JSON.parse(data);
            console.log("Received SSE data:", JSON.stringify(json, null, 2));
            
            // Check for thinking output if enabled
            if (json.thinking) {
              console.log("Received thinking output");
              out.push({
                role: "thinking",
                content: json.thinking
              });
              continue;
            }
            
            // Handle normal response delta
            const delta = fromChatCompletionChunk(json);
            if (delta?.content) {
              out.push({
                role: "assistant",
                content: delta.content
              });
            }
          } catch (e) {
            // Ignore parse errors and wait for more data
            console.log("JSON parse error in SSE stream:", e);
          }
        }
        return { done: false, messages: out };
      };
      
      /*
       * WHATWG Streams reader (Node 18+ or browser)
       */
      if (typeof (res.body as any).getReader === "function") {
        console.log("Using WHATWG streams reader");
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
      console.log("Using Node.js Readable stream");
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
    } catch (error) {
      console.error("Error in _streamChat:", error);
      throw error;
    }
  }
}