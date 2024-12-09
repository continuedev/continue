import { ControlPlaneProxyInfo } from "../../../control-plane/analytics/IAnalyticsProvider.js";
import { Telemetry } from "../../../util/posthog.js";
import OpenAI from "../OpenAI.js";

import type { Chunk, LLMOptions } from "../../../index.js";

class ContinueProxy extends OpenAI {
  set controlPlaneProxyInfo(value: ControlPlaneProxyInfo) {
    this.apiKey = value.workOsAccessToken;
    this.apiBase = new URL("openai/v1/", value.controlPlaneProxyUrl).toString();
  }

  static providerName = "continue-proxy";
  static defaultOptions: Partial<LLMOptions> = {
    useLegacyCompletionsEndpoint: false,
  };

  protected _getHeaders() {
    const headers: any = super._getHeaders();
    headers["x-continue-unique-id"] = Telemetry.uniqueId;
    return headers;
  }

  supportsCompletions(): boolean {
    return false;
  }

  supportsFim(): boolean {
    return true;
  }

  async rerank(query: string, chunks: Chunk[]): Promise<number[]> {
    const url = new URL("rerank", this.apiBase);
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

export default ContinueProxy;
