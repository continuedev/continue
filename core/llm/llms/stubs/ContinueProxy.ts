import { ControlPlaneProxyInfo } from "../../../control-plane/analytics/IAnalyticsProvider.js";
import { Telemetry } from "../../../util/posthog.js";
import OpenAI from "../OpenAI.js";

import type { LLMOptions, ModelProvider } from "../../../index.js";

class ContinueProxy extends OpenAI {
  set controlPlaneProxyInfo(value: ControlPlaneProxyInfo) {
    this.apiKey = value.workOsAccessToken;
    this.apiBase = new URL("openai/v1/", value.controlPlaneProxyUrl).toString();
  }

  static providerName: ModelProvider = "continue-proxy";
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
}

export default ContinueProxy;
