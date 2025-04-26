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
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml'; // YAML parser is required

export default class Databricks extends OpenAI {
  static providerName = "databricks";
  
  // Method to load model configuration from config.yaml
  private loadConfigFromYaml() {
    // Get user's home directory
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    // Path to config.yaml in .continue directory
    const configPath = path.join(homeDir, '.continue', 'config.yaml');
    
    try {
      // Check if file exists
      if (fs.existsSync(configPath)) {
        // Read and parse YAML file
        const configContent = fs.readFileSync(configPath, 'utf8');
        const config = yaml.load(configContent) as any;
        
        // Find model configuration matching current model name
        if (config && config.models) {
          const modelConfig = config.models.find(
            (m: any) => m.provider === 'databricks' && m.model === this.model
          );
          
          if (modelConfig) {
            return {
              token: modelConfig.apiKey,
              // If URL isn't in config, infer from model info or get from alternative source
              url: modelConfig.endpoint || modelConfig.url || 'https://adb-1981899174914086.6.azuredatabricks.net'
            };
          }
        }
      }
    } catch (error) {
      console.error('Error loading configuration file:', error);
    }
    
    // Fall back to environment variables if config.yaml loading fails
    return {
      token: process.env.DATABRICKS_TOKEN,
      url: process.env.YOUR_DATABRICKS_URL
    };
  }

  constructor(opts: LLMOptions) {
    // Load configuration from config.yaml
    const config = new Databricks.prototype.loadConfigFromYaml();
    
    // Improved error message when configuration values are missing
    if (!config.token || !config.url) {
      throw new Error(
        "Databricks connection information not found. Please configure settings through VS Code GUI or set environment variables."
      );
    }
    
    // Complete options to match the format expected by OpenAI base class
    opts = { 
      ...opts, 
      apiKey: opts.apiKey ?? config.token,
      apiBase: opts.apiBase ?? config.url
    };
    
    opts.apiBase = (opts.apiBase ?? '').replace(/\/+$/, ''); // Remove trailing slashes
    super(opts);
  }

  /**
   * Generate invocation URL
   * Example: https://adb-xxx.azuredatabricks.net/serving-endpoints/gpt-3.5-15b/invocations
   */
  private getInvocationUrl(): string {
    return `${this.apiBase}/serving-endpoints/${this.model}/invocations`;
  }
  
  /**
   * Read Databricks SSE responses and yield ChatMessages sequentially
   */
  protected async *_streamChat(
    msgs: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    // Build OpenAI-compatible request body
    const body: any = this._convertArgs(options, msgs);
    body.stream = true;
    const res = await this.fetch(this.getInvocationUrl(), {
      method: "POST",
      headers: this._getHeaders(),
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status}`);
    }
    const decoder = new TextDecoder();
    let buffer = "";
    /**
     * Parse the received buffer into SSE lines
     */
    const parseSSE = (
      str: string,
    ): { done: boolean; messages: ChatMessage[] } => {
      buffer += str;
      const out: ChatMessage[] = [];
      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return { done: true, messages: out };
        try {
          const json = JSON.parse(data);
          const delta = fromChatCompletionChunk(json);
          if (delta?.content) {
            out.push({ role: "assistant", content: delta.content });
          }
        } catch {
          // Incomplete JSON → continue processing with next chunk
        }
      }
      return { done: false, messages: out };
    };
    /*
     * WHATWG Streams implementation (Node 18+/browser)
     */
    if (typeof (res.body as any).getReader === "function") {
      const reader = (res.body as any).getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const { done: end, messages } = parseSSE(
          decoder.decode(value, { stream: true }),
        );
        for (const m of messages) yield m;
        if (end) return;
      }
      return;
    }
    /*
     * Node 16 and earlier stream.Readable
     */
    for await (const chunk of res.body as any) {
      const { done, messages } = parseSSE(
        decoder.decode(chunk, { stream: true }),
      );
      for (const m of messages) yield m;
      if (done) return;
    }
  }
}