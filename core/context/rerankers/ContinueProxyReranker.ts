import fetch from "node-fetch";

import { ControlPlaneProxyInfo } from "../../control-plane/analytics/IAnalyticsProvider.js";
import { Chunk } from "../../index.js";
import { BaseLLM } from "../../llm/index.js";

export class ContinueProxyReranker extends BaseLLM {
  static providerName = "continue-proxy";

  private _controlPlaneProxyInfo?: ControlPlaneProxyInfo;

  set controlPlaneProxyInfo(value: ControlPlaneProxyInfo) {
    this.apiKey = value.workOsAccessToken!;
    this._controlPlaneProxyInfo = value;
  }

  async rerank(query: string, chunks: Chunk[]): Promise<number[]> {
    const url = new URL(
      "openai/v1/rerank",
      this._controlPlaneProxyInfo?.controlPlaneProxyUrl,
    );
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        query,
        documents: chunks.map((chunk) => chunk.content),
        model: this.model,
      }),
    });
    const data: any = await resp.json();
    const results = data.data.sort((a: any, b: any) => a.index - b.index);
    return results.map((result: any) => result.relevance_score);
  }
}
