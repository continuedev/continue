import {
  ContinueProperties,
  decodeSecretLocation,
  parseProxyModelName,
  SecretType,
} from "@continuedev/config-yaml";

import { ControlPlaneProxyInfo } from "../../../control-plane/analytics/IAnalyticsProvider.js";
import { Telemetry } from "../../../util/posthog.js";
import OpenAI from "../OpenAI.js";

import type { Chunk, LLMOptions } from "../../../index.js";
import { LLMConfigurationStatuses } from "../../constants.js";

class ContinueProxy extends OpenAI {
  set controlPlaneProxyInfo(value: ControlPlaneProxyInfo) {
    this.apiKey = value.workOsAccessToken;
    if (!this.onPremProxyUrl) {
      this.apiBase = new URL(
        "model-proxy/v1/",
        value.controlPlaneProxyUrl,
      ).toString();
    }
  }

  // The apiKey and apiBase are set to the values for the proxy,
  // but we need to keep track of the actual values that the proxy will use
  // to call whatever LLM API is chosen
  private actualApiBase?: string;

  // Contains extra properties that we pass along to the proxy. Originally from `env` property on LLMOptions
  private configEnv?: Record<string, any>;

  constructor(options: LLMOptions) {
    super(options);
    this.configEnv = options.env;
    // This it set to `undefined` to handle the case where we are proxying requests to Azure. We pass the correct env vars
    // needed to do this in `extraBodyProperties` below, but if we don't set `apiType` to `undefined`, we end up proxying to
    // `/openai/deployments/` which is invalid since that URL construction happens on the proxy.
    this.apiType = undefined;
    this.actualApiBase = options.apiBase;
    this.apiKeyLocation = options.apiKeyLocation;
    this.orgScopeId = options.orgScopeId;
    this.onPremProxyUrl = options.onPremProxyUrl;
    if (this.onPremProxyUrl) {
      this.apiBase = new URL("model-proxy/v1/", this.onPremProxyUrl).toString();
    }
  }

  static providerName = "continue-proxy";
  static defaultOptions: Partial<LLMOptions> = {
    useLegacyCompletionsEndpoint: false,
  };

  get underlyingProviderName(): string {
    const { provider } = parseProxyModelName(this.model);
    return provider;
  }

  protected extraBodyProperties(): Record<string, any> {
    const continueProperties: ContinueProperties = {
      apiKeyLocation: this.apiKeyLocation,
      apiBase: this.actualApiBase,
      orgScopeId: this.orgScopeId ?? null,
      env: this.configEnv,
    };
    return {
      continueProperties,
    };
  }

  getConfigurationStatus() {
    if (!this.apiKeyLocation) {
      return LLMConfigurationStatuses.VALID;
    }

    const secretLocation = decodeSecretLocation(this.apiKeyLocation);
    if (secretLocation.secretType === SecretType.NotFound) {
      return LLMConfigurationStatuses.MISSING_API_KEY;
    }

    return LLMConfigurationStatuses.VALID;
  }

  protected _getHeaders() {
    const headers: any = super._getHeaders();
    headers["x-continue-unique-id"] = Telemetry.uniqueId;
    return headers;
  }

  supportsCompletions(): boolean {
    // This was a hotfix and contains duplicate logic from class-specific completion support methods
    if (this.underlyingProviderName === "vllm") {
      return true;
    }
    // other providers that don't support completions include groq, mistral, nvidia, deepseek, etc.
    // For now disabling all except vllm
    return false;
  }

  supportsFim(): boolean {
    const { provider } = parseProxyModelName(this.model);
    if (provider === "vllm") {
      return false;
    }
    return true;
  }

  async rerank(query: string, chunks: Chunk[]): Promise<number[]> {
    const url = new URL("rerank", this.apiBase);
    const resp = await this.fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        query,
        documents: chunks.map((chunk) => chunk.content),
        model: this.model,
        ...this.extraBodyProperties(),
      }),
    });
    const data: any = await resp.json();
    const results = data.data.sort((a: any, b: any) => a.index - b.index);
    return results.map((result: any) => result.relevance_score);
  }
}

export default ContinueProxy;
