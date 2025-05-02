import { Chunk, LLMOptions } from "../../index.js";
import { BaseLLM } from "../index.js";

class HuggingFaceTEIEmbeddingsProvider extends BaseLLM {
  static providerName = "huggingface-tei";

  static defaultOptions: Partial<LLMOptions> | undefined = {
    apiBase: "http://localhost:8080",
    model: "tei",
  };

  constructor(options: LLMOptions) {
    super(options);

    this.doInfoRequest()
      .then((response) => {
        this.model = response.model_id;
        this.maxEmbeddingBatchSize = response.max_client_batch_size;
      })
      .catch((error) => {
        console.error(
          "Failed to fetch info from HuggingFace TEI Embeddings Provider:",
          error,
        );
      });
  }

  async embed(chunks: string[]) {
    const batchedChunks = this.getBatchedChunks(chunks);

    const results = await Promise.all(
      batchedChunks.map((batch) => this.doEmbedRequest(batch)),
    );
    return results.flat();
  }

  async doEmbedRequest(batch: string[]): Promise<number[][]> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
  
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
  
    const resp = await this.fetch(new URL("embed", this.apiBase), {
      method: "POST",
      body: JSON.stringify({
        inputs: batch,
      }),
      headers,
    });
    if (!resp.ok) {
      const text = await resp.text();
      const embedError = JSON.parse(text) as TEIEmbedErrorResponse;
      if (!embedError.error_type || !embedError.error) {
        throw new Error(text);
      }
      throw new TEIEmbedError(embedError);
    }
    return (await resp.json()) as number[][];
  }

  async doInfoRequest(): Promise<TEIInfoResponse> {
    // TODO - need to use custom fetch for this request?
    const resp = await this.fetch(new URL("info", this.apiBase), {
      method: "GET",
    });
    if (!resp.ok) {
      throw new Error(await resp.text());
    }
    return (await resp.json()) as TEIInfoResponse;
  }

  async rerank(query: string, chunks: Chunk[]): Promise<number[]> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const resp = await this.fetch(new URL("rerank", this.apiBase), {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: query,
        return_text: false,
        raw_scores: false,
        texts: chunks.map((chunk) => chunk.content),
        truncation_direction: "Right",
        truncate: true,
      }),
    });

    if (!resp.ok) {
      throw new Error(await resp.text());
    }

    const data = (await resp.json()) as any;
    // Resort into original order and extract scores
    const results = data.sort((a: any, b: any) => a.index - b.index);
    return results.map((result: any) => result.score);
  }
}

class TEIEmbedError extends Error {
  constructor(teiResponse: TEIEmbedErrorResponse) {
    super(JSON.stringify(teiResponse));
  }
}

type TEIEmbedErrorResponse = {
  error: string;
  error_type: string;
};

type TEIInfoResponse = {
  model_id: string;
  model_sha: string;
  model_dtype: string;
  model_type: {
    embedding: {
      pooling: string;
    };
  };
  max_concurrent_requests: number;
  max_input_length: number;
  max_batch_tokens: number;
  max_batch_requests: number;
  max_client_batch_size: number;
  auto_truncate: boolean;
  tokenization_workers: number;
  version: string;
  sha: string;
  docker_label: string;
};

export default HuggingFaceTEIEmbeddingsProvider;
