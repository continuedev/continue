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
   * Override the header generation to add Accept header for streaming
   * @returns Headers object with auth and content type headers
   */
  protected _getHeaders(): { "Content-Type": string; Authorization: string; "api-key": string; } {
    const headers = super._getHeaders();
    
    // ヘッダーを型安全にカスタマイズするため、any型にキャスト
    const customHeaders = headers as any;
    
    // ストリーミングのためのヘッダーを追加
    customHeaders["Accept"] = "text/event-stream";
    
    // Content-Typeが未設定の場合は追加（元のヘッダーオブジェクトには含まれているはず）
    if (!customHeaders["Content-Type"]) {
      customHeaders["Content-Type"] = "application/json";
    }
    
    console.log("送信ヘッダー:", customHeaders);
    return headers;
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
      stop: options.stream
    });
    
    // ストリーミングが失敗した場合、この変数をfalseに設定してください
    // 問題解決のためのデバッグ変数
    const enableStreaming = false; // ストリーミングを無効にして非同期モードでテスト
    
    // Determine thinking budget and if thinking is enabled
    const thinkingBudget = options.reasoningBudgetTokens || 
                          this.modelConfig?.defaultCompletionOptions?.thinking?.budget_tokens || 
                          4000;
    
    const isThinkingEnabled = options.reasoning || 
                              (this.modelConfig?.defaultCompletionOptions?.thinking?.type === "enabled");
    
    // Ensure max_tokens is greater than thinking budget
    const maxTokens = Math.max(
      options.maxTokens ?? this.modelConfig?.defaultCompletionOptions?.maxTokens ?? 4096,
      thinkingBudget + 1000 // Add buffer to ensure it's greater than thinking budget
    );
    
    // Build parameters object with conditional parameters based on thinking mode
    const finalOptions: any = {
      model: options.model || this.modelConfig?.model,
      temperature: options.temperature ?? this.modelConfig?.defaultCompletionOptions?.temperature ?? 0.7,
      max_tokens: maxTokens,
      stop: options.stop?.filter(x => x.trim() !== "") ?? this.modelConfig?.defaultCompletionOptions?.stop ?? [],
      stream: enableStreaming && (options.stream ?? this.modelConfig?.defaultCompletionOptions?.stream ?? true)
    };
    
    // Only add top_k and top_p if thinking is not enabled
    if (!isThinkingEnabled) {
      finalOptions.top_k = options.topK ?? this.modelConfig?.defaultCompletionOptions?.topK ?? 100;
      finalOptions.top_p = options.topP ?? this.modelConfig?.defaultCompletionOptions?.topP ?? 0.95;
    } else {
      console.log("Omitting top_k and top_p parameters because thinking is enabled");
    }
    
    // 思考モードの設定がある場合、Databricksの思考パラメータを追加
    if (isThinkingEnabled) {
      // Databricksの思考パラメータを追加
      finalOptions.thinking = {
        type: "enabled",
        budget_tokens: thinkingBudget
      };
      console.log("Added thinking parameter with budget:", thinkingBudget);
      console.log("Ensured max_tokens is greater than thinking budget:", maxTokens);
    }
    
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
   * Create a system message that enables thinking mode if requested.
   * Based on the Anthropic implementation approach.
   * @param options CompletionOptions
   * @param originalSystemMessage Original system message if any
   * @returns Enhanced system message with thinking instructions
   */
  private createEnhancedSystemMessage(
    options: CompletionOptions, 
    originalSystemMessage?: string
  ): string {
    // Start with the original system message
    let systemMessage = originalSystemMessage || "";
    
    // Determine if thinking mode should be enabled
    const enableThinking = options.reasoning || 
      (this.modelConfig?.defaultCompletionOptions?.thinking?.type === "enabled");
    
    // Add thinking instructions if enabled
    if (enableThinking) {
      const budgetTokens = options.reasoningBudgetTokens || 
        this.modelConfig?.defaultCompletionOptions?.thinking?.budget_tokens || 
        4000;
      
      const thinkingInstructions = `\n\nI'd like you to solve this problem step-by-step, showing your reasoning process clearly. Take your time to think through this thoroughly before giving your final answer. Use up to ${budgetTokens} tokens to explore different approaches and ensure your solution is correct.`;
      
      systemMessage += thinkingInstructions;
      console.log("Enabled thinking mode with budget:", budgetTokens);
    }
    
    return systemMessage;
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
    const originalSystemMessage = this.extractSystemMessage(msgs);
    
    // Create enhanced system message with thinking instructions if needed
    const enhancedSystemMessage = this.createEnhancedSystemMessage(options, originalSystemMessage);
    
    // Build request body
    const body = {
      ...this.convertArgs(options),
      messages: convertedMessages,
      system: enhancedSystemMessage
    };
    
    // ストリーミングが明示的に無効化されていない限り有効にする
    body.stream = body.stream !== false;
    
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
      // タイムアウト設定を追加
      const fetchOptions = {
        method: "POST",
        headers: this._getHeaders(),
        body: JSON.stringify(body),
        signal,
        timeout: 300000 // 5分のタイムアウト
      };
      
      // fetchオプションに明示的にタイムアウトを追加できない場合はこの行を削除
      const timeoutOption = (fetchOptions as any).timeout;
      console.log("タイムアウト設定:", timeoutOption ? `${timeoutOption}ms` : "未設定");
      
      const res = await this.fetch(invocationUrl, fetchOptions);
      
      console.log("Response status:", res.status);
      console.log("レスポンスヘッダー:", Object.fromEntries([...res.headers.entries()]));
      console.log("コンテンツタイプ:", res.headers.get("content-type"));
      
      // Check for HTTP errors or missing body
      if (!res.ok || !res.body) {
        console.error("HTTP error response:", res.status, res.statusText);
        throw new Error(`HTTP ${res.status}`);
      }

      // ストリーミングが無効の場合、1回のレスポンスを返す
      if (body.stream === false) {
        console.log("Non-streaming mode, processing single response");
        const jsonResponse = await res.json();
        console.log("Received complete response:", JSON.stringify(jsonResponse, null, 2));
        
        try {
          // さまざまな形式を処理
          if (jsonResponse.choices && jsonResponse.choices[0]?.message?.content) {
            // OpenAI形式
            yield {
              role: "assistant",
              content: jsonResponse.choices[0].message.content
            };
          } else if (jsonResponse.content) {
            // 直接コンテンツ形式
            const contentValue = jsonResponse.content;
            if (typeof contentValue === "string") {
              yield {
                role: "assistant",
                content: contentValue
              };
            } else if (Array.isArray(contentValue)) {
              // 配列形式のコンテンツ（Anthropic形式など）
              const textContent = contentValue.find(item => item.type === "text")?.text || 
                                 (contentValue[0] && contentValue[0].text) || 
                                 JSON.stringify(contentValue);
              yield {
                role: "assistant",
                content: textContent
              };
            } else {
              // オブジェクト形式（未知の形式）
              yield {
                role: "assistant",
                content: "複雑なレスポンス形式: " + JSON.stringify(contentValue)
              };
            }
          } else if (jsonResponse.completion) {
            // Anthropic互換形式
            yield {
              role: "assistant",
              content: jsonResponse.completion
            };
          } else if (jsonResponse.message?.content) {
            // 別の形式のOpenAI互換
            yield {
              role: "assistant",
              content: jsonResponse.message.content
            };
          } else {
            console.log("未知のレスポンス形式:", jsonResponse);
            yield {
              role: "assistant",
              content: "Response format not recognized: " + JSON.stringify(jsonResponse)
            };
          }
        } catch (e) {
          console.error("レスポンス処理エラー:", e);
          throw e;
        }
        return;
      }
      
      const decoder = new TextDecoder();
      let buffer = "";
      let rawBuffer = ""; // すべてのレスポンスデータを記録
      
      /**
       * 受信したバッファをSSEラインに解析してメッセージを抽出します。
       * @param str SSEデータの文字列チャンク。
       * @returns 'done'フラグとChatMessagesの配列を含むオブジェクト。
       */
      const parseSSE = (
        str: string,
      ): { done: boolean; messages: ChatMessage[] } => {
        buffer += str;
        const out: ChatMessage[] = [];
        
        // バッファ全体がJSON形式かどうかを確認
        if (buffer.trim() && !buffer.includes("\n")) {
          try {
            const trimmedBuffer = buffer.trim();
            // データプレフィックスを削除
            const jsonStr = trimmedBuffer.startsWith("data:") ? 
                         trimmedBuffer.slice(trimmedBuffer.indexOf("{")) : 
                         trimmedBuffer;
            
            console.log("単一JSONの解析を試行:", jsonStr);
            const json = JSON.parse(jsonStr);
            console.log("単一JSONを解析:", json);
            
            // 異なる形式のレスポンスを処理
            if (json.choices && json.choices[0]?.message?.content) {
              // OpenAI形式の完全なレスポンス
              console.log("OpenAI形式の完全なレスポンスを検出");
              out.push({
                role: "assistant",
                content: json.choices[0].message.content
              });
              buffer = "";
              return { done: true, messages: out };
            }
          } catch (e) {
            console.log("単一JSON解析エラー、行解析に切り替え:", e);
          }
        }
        
        let idx: number;
        // Process each line in the buffer
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          
          console.log("処理中の行:", line);
          
          // 空行をスキップ
          if (!line) continue;
          
          // "data:"プレフィックスを確認
          if (!line.startsWith("data:") && !line.startsWith("data: ")) {
            console.log("data:プレフィックスのない行をスキップ:", line);
            continue;
          }
          
          // プレフィックスを削除してデータを取得
          const data = line.startsWith("data: ") ? line.slice(6).trim() : line.slice(5).trim();
          
          // [DONE]マーカーを確認
          if (data === "[DONE]") {
            console.log("Received [DONE] marker");
            return { done: true, messages: out };
          }
          
          try {
            // Parse JSON and convert to chat message delta
            const json = JSON.parse(data);
            console.log("Received SSE data:", JSON.stringify(json, null, 2));
            
            // 複数の形式をサポート
            
            // 1. 思考出力がある場合
            if (json.thinking || (json.content && json.content[0]?.type === "reasoning")) {
              console.log("思考出力を検出");
              let thinkingContent = json.thinking;
              
              // Databricks形式の思考出力を処理
              if (json.content && json.content[0]?.type === "reasoning") {
                thinkingContent = json.content[0].summary[0]?.text || "";
              }
              
              out.push({
                role: "thinking",
                content: thinkingContent
              });
            }
            // 2. Anthropic形式のデルタ
            else if (json.type === "content_block_delta" && json.delta?.text) {
              console.log("Anthropic形式のデルタを検出");
              out.push({
                role: "assistant",
                content: json.delta.text
              });
            }
            // 3. OpenAI形式のデルタ
            else if (json.choices && json.choices[0]?.delta?.content) {
              console.log("OpenAI形式のデルタを検出");
              out.push({
                role: "assistant",
                content: json.choices[0].delta.content
              });
            }
            // 4. 直接content形式
            else if (json.content && typeof json.content === "string") {
              console.log("直接content形式を検出");
              out.push({
                role: "assistant",
                content: json.content
              });
            }
            // 5. コンテンツ配列を持つ形式
            else if (json.content && Array.isArray(json.content) && json.content[0]?.text) {
              console.log("コンテンツ配列形式を検出");
              out.push({
                role: "assistant",
                content: json.content[0].text
              });
            }
            // 6. 直接テキスト形式
            else if (json.text) {
              console.log("直接テキスト形式を検出");
              out.push({
                role: "assistant",
                content: json.text
              });
            }
            // 7. OpenAI形式のチャンク
            else {
              const delta = fromChatCompletionChunk(json);
              if (delta?.content) {
                console.log("OpenAI形式のチャンクからコンテンツを抽出");
                out.push({
                  role: "assistant",
                  content: delta.content
                });
              } else {
                console.log("不明なJSON形式:", json);
              }
            }
          } catch (e) {
            // JSONの解析エラーをログに記録
            console.log("SSEストリームでJSON解析エラー:", e);
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
          if (done) {
            console.log("ストリーム読み取り完了");
            break;
          }
          
          // チャンクのバイナリデータをログ（型付けの問題を修正）
          console.log("受信したチャンク（バイト）:", value ? 
            Array.from(new Uint8Array(value as ArrayBuffer)).map((b: number) => b.toString(16)).join(' ') : 
            'null');
          
          const decodedChunk = decoder.decode(value as Uint8Array, { stream: true });
          rawBuffer += decodedChunk; // 全てのデータを記録
          console.log("受信したチャンク（テキスト）:", decodedChunk);
          
          // チャンクが空でないことを確認
          if (!decodedChunk || decodedChunk.trim() === "") {
            console.log("空のチャンクを受信しました");
            continue;
          }
          
          const { done: end, messages } = parseSSE(decodedChunk);
          for (const m of messages) {
            yield m;
          }
          if (end) {
            console.log("ストリーム終了マーカーを検出");
            return;
          }
        }
        
        // ストリーム終了後にバッファに残っているものを処理
        if (buffer.trim()) {
          console.log("残りのバッファを処理:", buffer);
          const { messages } = parseSSE("");
          for (const m of messages) {
            yield m;
          }
        }
        
        // 全レスポンスの記録
        console.log("完全な受信データ:", rawBuffer);
        return;
      }
      
      /*
       * Node.js Readable stream (Node 16 and below)
       */
      console.log("Using Node.js Readable stream");
      try {
        for await (const chunk of res.body as any) {
          try {
            // チャンクの生データをログ（オブジェクトそのものを出力）
            console.log("受信したチャンク（バイト）:", typeof chunk === 'object' ? '(バイナリデータ)' : chunk);
            
            const decodedChunk = decoder.decode(chunk as Buffer, { stream: true });
            rawBuffer += decodedChunk; // 全てのデータを記録
            console.log("受信したチャンク（テキスト）:", decodedChunk);
            
            // チャンクが空でないことを確認
            if (!decodedChunk || decodedChunk.trim() === "") {
              console.log("空のチャンクを受信しました");
              continue;
            }
            
            const { done, messages } = parseSSE(decodedChunk);
            for (const m of messages) {
              yield m;
            }
            if (done) {
              console.log("ストリーム終了マーカーを検出");
              return;
            }
          } catch (e) {
            console.error("チャンク処理中のエラー:", e);
          }
        }
        
        // ストリーム終了後にバッファに残っているものを処理
        if (buffer.trim()) {
          console.log("残りのバッファを処理:", buffer);
          const { messages } = parseSSE("");
          for (const m of messages) {
            yield m;
          }
        }
        
        // 全レスポンスの記録
        console.log("完全な受信データ:", rawBuffer);
      } catch (streamError) {
        console.error("ストリーム読み取り中のエラー:", streamError);
        
        // エラーが発生した場合でも、受信したデータを処理
        console.log("エラー発生後に受信データを処理:", rawBuffer);
        
        // レスポンス全体をJSONとして解析を試みる
        try {
          const jsonResponse = JSON.parse(rawBuffer);
          console.log("レスポンス全体をJSONとして解析:", jsonResponse);
          
          if (jsonResponse.choices && jsonResponse.choices[0]?.message?.content) {
            yield {
              role: "assistant",
              content: jsonResponse.choices[0].message.content
            };
          } else if (jsonResponse.content) {
            yield {
              role: "assistant",
              content: typeof jsonResponse.content === "string" ? 
                jsonResponse.content : 
                JSON.stringify(jsonResponse.content)
            };
          }
        } catch (parseError) {
          console.error("最終解析の試みに失敗:", parseError);
          throw streamError; // 元のエラーを再スロー
        }
      }
    } catch (error) {
      console.error("Error in _streamChat:", error);
      throw error;
    }
  }
}