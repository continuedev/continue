import { CompletionOptions, LLMOptions } from "../../index.js";
import { BaseLLM } from "../index.js";
import { LlmApiRequestType } from "../openaiTypeConverters.js";
import { streamSse } from "../stream.js";

// Define a custom interface for the llama.cpp reranking response
interface LlamaCppRerankResponse {
  model: string;
  object: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
  results: Array<{
    index: number;
    relevance_score: number;
  }>;
}

class LlamaCpp extends BaseLLM {
  static providerName = "llama.cpp";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "http://127.0.0.1:8080/",
  };

  private _convertArgs(options: CompletionOptions, prompt: string) {
    const finalOptions = {
      n_predict: options.maxTokens,
      frequency_penalty: options.frequencyPenalty,
      presence_penalty: options.presencePenalty,
      min_p: options.minP,
      mirostat: options.mirostat,
      stop: options.stop,
      top_k: options.topK,
      top_p: options.topP,
      temperature: options.temperature,
    };

    return finalOptions;
  }

  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      ...this.requestOptions?.headers,
    };

    const resp = await this.fetch(new URL("completions", this.apiBase), {
      method: "POST",
      headers,
      body: JSON.stringify({
        prompt,
        stream: true,
        ...this._convertArgs(options, prompt),
      }),
      signal,
    });

    for await (const value of streamSse(resp)) {
      if (value.content) {
        yield value.content;
      }
    }
  }

  protected useOpenAIAdapterFor: (LlmApiRequestType | "*")[] = [
    "rerank",
  ];

  protected createOpenAiAdapter() {
    const adapter = super.createOpenAiAdapter();
    
    if (adapter) {
      // Create a wrapper around the original rerank method to handle llama.cpp response format
      const originalRerank = adapter.rerank.bind(adapter);
      
      adapter.rerank = async (params) => {
        // Get the URL for the rerank endpoint
        const url = new URL("rerank", this.apiBase);
        
        // Make a direct fetch request to get the raw response
        const response = await this.fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
            ...this.requestOptions?.headers,
          },
          body: JSON.stringify({
            model: params.model,
            query: params.query,
            documents: params.documents,
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to rerank: ${response.status} ${response.statusText}`);
        }
        
        // Parse the response as the custom type
        const llamaResponse = await response.json() as LlamaCppRerankResponse;
        
        // Transform to expected OpenAI format with correct type
        return {
          object: "list" as const, // Use const assertion to match the exact string literal type
          model: llamaResponse.model,
          usage: llamaResponse.usage,
          // Map the results to data
          data: llamaResponse.results.map(item => ({
            index: item.index,
            relevance_score: item.relevance_score
          }))
        };
      };
    }
    
    return adapter;
  }
}

export default LlamaCpp;
