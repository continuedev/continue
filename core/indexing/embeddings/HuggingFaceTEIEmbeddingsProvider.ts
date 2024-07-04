import fetch, { Response } from "node-fetch";
import { EmbedOptions, FetchFunction } from "../..";
import { withExponentialBackoff } from "../../util/withExponentialBackoff";
import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider";

class HuggingFaceTEIEmbeddingsProvider extends BaseEmbeddingsProvider {
  private maxBatchSize = 32;

  static defaultOptions: Partial<EmbedOptions> | undefined = {
    apiBase: "http://localhost:8080",
    model: "tei",
  };

  constructor(options: EmbedOptions, fetch: FetchFunction) {
    super(options, fetch);
    // without this extra slash the last portion of the path will be dropped from the URL when using the node.js URL constructor
    if (!this.options.apiBase?.endsWith("/")) {
      this.options.apiBase += "/";
    }
    this.doInfoRequest().then(response => {
      this.options.model = response.model_id;
      this.maxBatchSize = response.max_client_batch_size;
    });
  }

  async embed(chunks: string[]) {
    const promises = [];
    for (let i = 0; i < chunks.length; i += this.maxBatchSize) {
      promises.push(this.doEmbedRequest(chunks.slice(i, i + this.maxBatchSize)));
    }
    const results = await Promise.all(promises);
    return results.flat();
  }

  async doEmbedRequest(batch: string[]): Promise<number[][]> {
    const resp = await withExponentialBackoff<Response>(() =>
      this.fetch(new URL("embed", this.options.apiBase), {
        method: "POST",
        body: JSON.stringify({
          inputs: batch
        }),
        headers: {
          "Content-Type": "application/json",
        }
      }),
    );
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
    const resp = await withExponentialBackoff<Response>(() =>
      this.fetch(new URL("info", this.options.apiBase), {
        method: "GET",
      }),
    );
    if (!resp.ok) {
      throw new Error(await resp.text());
    }
    return (await resp.json()) as TEIInfoResponse;
  }
}

class TEIEmbedError extends Error {
  constructor(teiResponse: TEIEmbedErrorResponse) {
    super(JSON.stringify(teiResponse));
  }
}

type TEIEmbedErrorResponse = {
  error: string
  error_type: string
}

type TEIInfoResponse = {
  model_id: string;
  model_sha: string;
  model_dtype: string;
  model_type: {
    embedding: {
      pooling: string;
    }
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
