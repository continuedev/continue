import fetch from "node-fetch";

import { ControlPlaneProxyInfo } from "../../control-plane/analytics/IAnalyticsProvider.js";
import { Chunk, Reranker } from "../../index.js";

export class ContinueProxyReranker implements Reranker {
  name = "continue-proxy";

  private _controlPlaneProxyInfo?: ControlPlaneProxyInfo;

  set controlPlaneProxyInfo(value: ControlPlaneProxyInfo) {
    this.params.apiKey = value.workOsAccessToken!;
    this._controlPlaneProxyInfo = value;
  }

  constructor(
    private readonly params: {
      apiKey: string;
      model?: string;
    },
  ) {}

  async rerank(query: string, chunks: Chunk[]): Promise<number[]> {
    const url = new URL(
      "openai/v1/rerank",
      this._controlPlaneProxyInfo?.controlPlaneProxyUrl,
    );
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
