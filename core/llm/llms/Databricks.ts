import * as fs from "fs";
import * as yaml from "js-yaml";
import * as os from "os";
import * as path from "path";
import { ChatMessage, CompletionOptions, LLMOptions } from "../../index";
import { fromChatCompletionChunk } from "../openaiTypeConverters";
import OpenAI from "./OpenAI";

export default class Databricks extends OpenAI {
  static providerName = "databricks";

  private static loadConfigFromYaml(modelName: string): any {
    const homeDir = os.homedir();
    const configPath = path.join(homeDir, ".continue", "config.yaml");

    try {
      if (fs.existsSync(configPath)) {
        const fileContents = fs.readFileSync(configPath, "utf8");
        const parsed = yaml.load(fileContents) as any;
        if (parsed && Array.isArray(parsed.models)) {
          const modelConfig = parsed.models.find(
            (m: any) => m.provider === "databricks" && m.model === modelName
          );
          if (modelConfig) {
            return modelConfig;
          }
        }
      }
    } catch (error) {
      console.error("Error reading config.yaml:", error);
    }

    throw new Error("Model configuration not found in config.yaml.");
  }

  constructor(opts: LLMOptions) {
    const modelName = opts.model;
    if (!modelName) {
      throw new Error("No model specified for Databricks.");
    }

    const config = Databricks.loadConfigFromYaml(modelName);
    opts = {
      ...opts,
      apiKey: opts.apiKey ?? config.apiKey,
      apiBase: opts.apiBase ?? config.apiBase,
      completionOptions: {
        ...config.defaultCompletionOptions,
        ...opts.completionOptions,
      },
    };

    super(opts);
  }

  private getInvocationUrl(): string {
    return this.apiBase;
  }

  protected async *_streamChat(
    msgs: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions
  ): AsyncGenerator<ChatMessage> {
    const body: any = this._convertArgs(options, msgs);
    body.stream = true;

    // Include thinking and budget_tokens if available
    const thinking = options.thinking;
    if (thinking && thinking.type === "enabled") {
      body.thinking = {
        type: "enabled",
        budget_tokens: thinking.budget_tokens,
      };
    }

    const invocationUrl = this.getInvocationUrl();
    try {
      const res = await this.fetch(invocationUrl, {
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

      const parseSSE = (str: string): { done: boolean; messages: ChatMessage[] } => {
        buffer += str;
        const out: ChatMessage[] = [];
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") {
            return { done: true, messages: out };
          }
          try {
            const json = JSON.parse(data);
            const delta = fromChatCompletionChunk(json);
            if (delta?.content) {
              out.push({ role: "assistant", content: delta.content });
            }
          } catch (e) {
            console.log("JSON parse error in SSE stream:", e);
          }
        }
        return { done: false, messages: out };
      };

      if (typeof (res.body as any).getReader === "function") {
        const reader = (res.body as any).getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const { done: end, messages } = parseSSE(
            decoder.decode(value as Uint8Array, { stream: true })
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

      for await (const chunk of res.body as any) {
        const { done, messages } = parseSSE(
          decoder.decode(chunk as Buffer, { stream: true })
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
