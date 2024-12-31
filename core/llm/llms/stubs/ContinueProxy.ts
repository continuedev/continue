import { ControlPlaneProxyInfo } from "../../../control-plane/analytics/IAnalyticsProvider.js";
import { Telemetry } from "../../../util/posthog.js";
import OpenAI from "../OpenAI.js";

import { ChatCompletionCreateParams } from "@continuedev/openai-adapters";
import type {
  ChatMessage,
  Chunk,
  CompletionOptions,
  LLMOptions,
} from "../../../index.js";

class ContinueProxy extends OpenAI {
  set controlPlaneProxyInfo(value: ControlPlaneProxyInfo) {
    this.apiKey = value.workOsAccessToken;
    this.apiBase = new URL("openai/v1/", value.controlPlaneProxyUrl).toString();
  }

  // The apiKey and apiBase are set to the values for the proxy,
  // but we need to keep track of the actual values that the proxy will use
  // to call whatever LLM API is chosen
  private actualApiBase?: string;
  private actualApiKey?: string;

  constructor(options: LLMOptions) {
    super(options);
    this.actualApiBase = options.apiBase;
    this.actualApiKey = options.apiKey;
  }

  static providerName = "continue-proxy";
  static defaultOptions: Partial<LLMOptions> = {
    useLegacyCompletionsEndpoint: false,
  };

  protected _convertArgs(
    options: CompletionOptions,
    messages: ChatMessage[],
  ): ChatCompletionCreateParams {
    const args: any = super._convertArgs(options, messages);
    args.continueProperties = {
      apiKey: this.actualApiKey,
      apiBase: this.actualApiBase,
      apiKeySecret: this.apiKeySecret,
    };
    return args;
  }

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
