/*
 * Databricks.ts — Continue LLM adapter for Databricks Model Serving
 * Copyright (c) 2025
 *
 * 必要な環境変数:
 *   - DATABRICKS_TOKEN      : Personal Access Token (PAT)
 *   - YOUR_DATABRICKS_URL   : Workspace URL (例: https://adb-xxxx.azuredatabricks.net)
 *
 * 既存の OpenAI ベースクラスを継承し、Databricks の Serving Endpoints へ
 * Streaming Chat Completions (SSE) でアクセスします。
 */

import OpenAI from "./OpenAI";
import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
} from "../../index";
import { fromChatCompletionChunk } from "../openaiTypeConverters";

export default class Databricks extends OpenAI {
  static providerName = "databricks";

  constructor(opts: LLMOptions) {
    const pat = process.env.DATABRICKS_TOKEN;
    const base = process.env.YOUR_DATABRICKS_URL; // 例: https://adb-xxx.azuredatabricks.net
    if (!pat || !base) {
      throw new Error(
        "YOUR_DATABRICKS_URL または DATABRICKS_TOKEN が .env に設定されていません",
      );
    }

    // OpenAI ベースクラスが期待する形に合わせてオプションを補完
    opts = { ...opts, apiKey: opts.apiKey ?? pat };
    opts.apiBase = (opts.apiBase ?? base).replace(/\/+$/, ""); // 末尾のスラッシュを削除
    super(opts);
  }

  /**
   * 呼び出し URL を生成
   * 例: https://adb-xxx.azuredatabricks.net/serving-endpoints/gpt-3.5-15b/invocations
   */
  private getInvocationUrl(): string {
    return `${this.apiBase}/serving-endpoints/${this.model}/invocations`;
  }

  /**
   * Databricks の SSE レスポンスを読み取り、ChatMessage を逐次 yield する
   */
  protected async *_streamChat(
    msgs: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    // OpenAI 互換のリクエストボディを組み立て
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
     * 受信済みバッファを SSE 行単位でパースする
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
          // 不完全な JSON → 次のチャンクで処理継続
        }
      }

      return { done: false, messages: out };
    };

    /*
     * WHATWG Streams 実装 (Node 18+/ブラウザ)
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
     * Node 16 以前の stream.Readable
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
