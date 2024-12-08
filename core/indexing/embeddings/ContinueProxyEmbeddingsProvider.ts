import { ControlPlaneProxyInfo } from "../../control-plane/analytics/IAnalyticsProvider.js";

import OpenAIEmbeddingsProvider from "./OpenAIEmbeddingsProvider.js";

class ContinueProxyEmbeddingsProvider extends OpenAIEmbeddingsProvider {
  static providerName = "continue-proxy";

  set controlPlaneProxyInfo(value: ControlPlaneProxyInfo) {
    this.apiKey = value.workOsAccessToken;
    this.apiBase = new URL("openai/v1", value.controlPlaneProxyUrl).toString();
  }
}

export default ContinueProxyEmbeddingsProvider;
