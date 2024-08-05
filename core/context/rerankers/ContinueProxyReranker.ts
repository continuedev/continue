import fetch from "node-fetch";
import { CONTROL_PLANE_URL } from "../../control-plane/client.js";
import { Chunk, Reranker } from "../../index.js";

export class ContinueProxyReranker implements Reranker {
  name = "continue-proxy";

  private _workOsAccessToken: string | undefined = undefined;

  get workOsAccessToken(): string | undefined {
    return this._workOsAccessToken;
  }

  set workOsAccessToken(value: string | undefined) {
    if (this._workOsAccessToken !== value) {
      this._workOsAccessToken = value;
      this.params.apiKey = value!;
    }
  }

  constructor(
    private readonly params: {
      apiKey: string;
      model?: string;
    },
  ) {}

  async rerank(query: string, chunks: Chunk[]): Promise<number[]> {
    const url = new URL("/model-proxy/v1/rerank", CONTROL_PLANE_URL);
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.params.apiKey}`,
      },
      body: JSON.stringify({
        query,
        documents: chunks.map((chunk) => chunk.content),
        model: this.params.model,
      }),
    });
    const data: any = await resp.json();
    const results = data.data.sort((a: any, b: any) => a.index - b.index);
    return results.map((result: any) => result.relevance_score);
  }
}
