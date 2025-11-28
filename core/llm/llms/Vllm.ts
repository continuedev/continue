import {
  ChatMessage,
  Chunk,
  CompletionOptions,
  LLMOptions,
} from "../../index.js";

import { LlmApiRequestType } from "../openaiTypeConverters.js";
import { ThinkingTagExtractor } from "../thinkingTagExtractor.js";
import OpenAI from "./OpenAI.js";

// vLLM-specific rerank response types
interface VllmRerankItem {
  index: number;
  document: {
    text: string;
  };
  relevance_score: number;
}

interface VllmRerankResponse {
  id: string;
  model: string;
  usage: {
    total_tokens: number;
  };
  results: VllmRerankItem[];
}

/**
 * vLLM-specific options for thinking output extraction.
 * These options allow configuring custom tags to extract thinking content from the response.
 */
export interface VllmOptions extends LLMOptions {
  /**
   * Custom opening tag for extracting thinking/reasoning content from streamed responses.
   * Used with models that output thinking content wrapped in custom tags (e.g., `<think>`, `<reasoning>`).
   * Must be used together with `thinkingCloseTag`.
   */
  thinkingOpenTag?: string;
  /**
   * Custom closing tag for extracting thinking/reasoning content from streamed responses.
   * Must be used together with `thinkingOpenTag`.
   */
  thinkingCloseTag?: string;
}

/**
 * vLLM provider for Continue.
 *
 * vLLM supports thinking/reasoning outputs in two ways:
 * 1. Via the standard `reasoning_content` field in the response (default OpenAI format)
 * 2. Via custom tags in the response content (configurable)
 *
 * For custom thinking tag formats, you can configure `thinkingOpenTag` and `thinkingCloseTag`
 * in the model options. For example:
 *
 * ```yaml
 * models:
 *   - provider: vllm
 *     model: deepseek-ai/DeepSeek-R1-Distill-Qwen-7B
 *     apiBase: http://localhost:8000
 *     thinkingOpenTag: "<think>"
 *     thinkingCloseTag: "</think>"
 * ```
 *
 * See vLLM documentation for more details:
 * https://docs.vllm.ai/en/latest/features/reasoning_outputs.html
 */
class Vllm extends OpenAI {
  static providerName = "vllm";

  // vLLM-specific options for thinking tag extraction
  private _thinkingOpenTag?: string;
  private _thinkingCloseTag?: string;

  // Override useOpenAIAdapterFor to NOT include "streamChat".
  // vLLM uses the reasoning_content field for thinking output (via vLLM's reasoning parser),
  // which is not part of the standard OpenAI SDK types. By excluding "streamChat", we force
  // the use of the parent class's _streamChat method which uses streamSse for direct SSE
  // parsing. This ensures proper handling of reasoning_content in streaming responses,
  // as streamSse parses JSON directly and preserves all fields including non-standard ones.
  protected override useOpenAIAdapterFor: (LlmApiRequestType | "*")[] = [
    "chat",
    "embed",
    "list",
    "rerank",
    "streamFim",
  ];

  constructor(options: VllmOptions) {
    super(options);

    // Validate that thinking tags are provided together
    if (
      (options.thinkingOpenTag && !options.thinkingCloseTag) ||
      (!options.thinkingOpenTag && options.thinkingCloseTag)
    ) {
      throw new Error(
        "vLLM: Both thinkingOpenTag and thinkingCloseTag must be provided together",
      );
    }

    // Store vLLM-specific options
    this._thinkingOpenTag = options.thinkingOpenTag;
    this._thinkingCloseTag = options.thinkingCloseTag;

    if (options.isFromAutoDetect) {
      this._setupCompletionOptions();
    }
  }

  /**
   * Override _streamChat to handle thinking tag extraction if configured.
   * This allows vLLM to support models that use custom tags (like <think>...</think>)
   * instead of the standard reasoning_content field.
   */
  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    // If no custom thinking tags configured, use parent implementation
    if (!this._thinkingOpenTag || !this._thinkingCloseTag) {
      for await (const chunk of super._streamChat(messages, signal, options)) {
        yield chunk;
      }
      return;
    }

    // Use thinking tag extractor for custom tag formats
    const extractor = new ThinkingTagExtractor(
      this._thinkingOpenTag,
      this._thinkingCloseTag,
    );

    for await (const chunk of super._streamChat(messages, signal, options)) {
      if (chunk.role === "assistant" && typeof chunk.content === "string") {
        const extracted = extractor.process(chunk.content);

        // Yield thinking content first
        if (extracted.thinking) {
          yield {
            role: "thinking",
            content: extracted.thinking,
          };
        }

        // Yield regular content if present
        if (extracted.content) {
          yield {
            ...chunk,
            content: extracted.content,
          };
        }
      } else {
        // Pass through non-assistant chunks unchanged
        yield chunk;
      }
    }

    // Flush any remaining content from the extractor
    const flushed = extractor.flush();
    if (flushed.thinking) {
      yield { role: "thinking", content: flushed.thinking };
    }
    if (flushed.content) {
      yield { role: "assistant", content: flushed.content };
    }
  }

  supportsFim(): boolean {
    return false;
  }

  async rerank(query: string, chunks: Chunk[]): Promise<number[]> {
    if (this.useOpenAIAdapterFor.includes("rerank") && this.openaiAdapter) {
      const results = (await this.openaiAdapter.rerank({
        model: this.model,
        query,
        documents: chunks.map((chunk) => chunk.content),
      })) as unknown as VllmRerankResponse;

      // vLLM uses 'results' array instead of 'data'
      if (results.results && Array.isArray(results.results)) {
        const sortedResults = results.results.sort((a, b) => a.index - b.index);
        return sortedResults.map((result) => result.relevance_score);
      }

      throw new Error(
        `vLLM rerank response missing 'results' array. Got: ${JSON.stringify(Object.keys(results))}`,
      );
    }

    throw new Error("vLLM rerank requires OpenAI adapter");
  }

  private _setupCompletionOptions() {
    this.fetch(this._getEndpoint("models"), {
      method: "GET",
      headers: this._getHeaders(),
    })
      .then(async (response) => {
        if (response.status !== 200) {
          console.warn(
            "Error calling vLLM /models endpoint: ",
            await response.text(),
          );
          return;
        }
        const json = await response.json();
        const data = json.data[0];
        this.model = data.id;
        this._contextLength = Number.parseInt(data.max_model_len);
      })
      .catch((e) => {
        console.log(`Failed to list models for vLLM: ${e.message}`);
      });
  }
}

export default Vllm;
