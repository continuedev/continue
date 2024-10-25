import { ControlPlaneProxyInfo } from "../../../control-plane/analytics/IAnalyticsProvider.js";
import type { LLMOptions, ModelProvider } from "../../../index.js";
import { Telemetry } from "../../../util/posthog.js";
import OpenAI from "../OpenAI.js";

class ContinueProxy extends OpenAI {
  set controlPlaneProxyInfo(value: ControlPlaneProxyInfo) {
    this.apiKey = value.workOsAccessToken;
    this.apiBase = new URL("openai/v1/", value.controlPlaneProxyUrl).toString();
  }

  static providerName: ModelProvider = "continue-proxy";
  static defaultOptions: Partial<LLMOptions> = {
    useLegacyCompletionsEndpoint: false,
    requestOptions: {
      headers: {
        "x-continue-unique-id": Telemetry.uniqueId,
      },
    },
  };

  supportsCompletions(): boolean {
    return false;
  }

  supportsFim(): boolean {
    return true;
  }
}

export default ContinueProxy;
