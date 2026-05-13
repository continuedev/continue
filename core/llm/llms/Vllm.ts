import { ChatCompletionCreateParams } from "openai/resources/chat/completions";
import { Chunk, CompletionOptions, LLMOptions } from "../../index.js";

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

class Vllm extends OpenAI {
  static providerName = "vllm";
  private _userExplicitContextLength: boolean;
  private _userExplicitModel: boolean;

  constructor(options: LLMOptions) {
    super(options);

    this._userExplicitContextLength = options.contextLength !== undefined;
    this._userExplicitModel =
      options.model !== undefined && options.model !== "";

    if (options.isFromAutoDetect) {
      this._setupCompletionOptions();
    }
  }

  supportsFim(): boolean {
    return false;
  }

  protected modifyChatBody(
    body: ChatCompletionCreateParams,
    options?: CompletionOptions,
  ): ChatCompletionCreateParams {
    body = super.modifyChatBody(body, options);
    // Qwen3 (and other thinking models) served via vLLM default to
    // enable_thinking=True, producing very long reasoning chains that can
    // timeout when the server is under load.  Mirror the session reasoning
    // toggle: disable thinking unless the caller explicitly enables it.
    const enableThinking = options?.reasoning === true;
    (body as any).chat_template_kwargs = { enable_thinking: enableThinking };
    return body;
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
        if (!this._userExplicitModel) {
          this.model = data.id;
        }
        if (!this._userExplicitContextLength) {
          this._contextLength = Number.parseInt(data.max_model_len);
        }
      })
      .catch((e) => {
        console.log(`Failed to list models for vLLM: ${e.message}`);
      });
  }
}

export default Vllm;
