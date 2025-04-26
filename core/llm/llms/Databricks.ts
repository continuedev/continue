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
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as yaml from "js-yaml";

export default class Databricks extends OpenAI {
  static providerName = "databricks";

  /**
   * Load Databricks model configuration from .continue/config.yaml.
   * Looks for a model entry matching the given modelName with provider 'databricks'.
   * @param modelName The model identifier to match in the config.
   * @returns Object containing apiKey and endpoint (may be undefined if not found).
   */
  private static loadConfigFromYaml(modelName: string): { apiKey?: string; endpoint?: string } {
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
              hasApiBase: !!modelConfig.apiBase
            });
            
            if (modelConfig && typeof modelConfig.apiKey === "string" && typeof modelConfig.apiBase === "string") {
              // Use endpoint if provided
              const endpointUrl = modelConfig.apiBase;
              console.log("Using apiBase from config:", endpointUrl);
              return {
                apiKey: modelConfig.apiKey,
                endpoint: endpointUrl,
              };
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
        endpoint: base,
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
    
    // Load configuration for this model from YAML
    console.log("Loading config for model:", modelName);
    const config = Databricks.loadConfigFromYaml(modelName);
    console.log("Loaded config:", { 
      apiKeyExists: !!config.apiKey, 
      endpoint: config.endpoint 
    });
    
    // Validate that apiKey and endpoint are present
    if (!config.apiKey || !config.endpoint) {
      throw new Error(
        "Databricks connection information not found. Please configure 'apiKey' and 'apiBase' for the model in .continue/config.yaml."
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
    console.log("Final apiBase after processing:", opts.apiBase);
    
    // Call the base class constructor with updated options
    super(opts);
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
    
    // Build request body using OpenAI conversion (chat format)
    const body: any = this._convertArgs(options, msgs);
    body.stream = true;
    
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
            return { done: true, messages: out };
          }
          try {
            // Parse JSON and convert to chat message delta
            const json = JSON.parse(data);
            const delta = fromChatCompletionChunk(json);
            if (delta?.content) {
              out.push({ role: "assistant", content: delta.content });
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
    } catch (error) {
      console.error("Error in _streamChat:", error);
      throw error;
    }
  }
}