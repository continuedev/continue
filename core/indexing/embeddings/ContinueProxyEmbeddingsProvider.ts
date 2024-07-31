import { CONTROL_PLANE_URL } from "../../control-plane/client.js";
import { EmbeddingsProviderName, EmbedOptions } from "../../index.js";
import OpenAIEmbeddingsProvider from "./OpenAIEmbeddingsProvider.js";

class ContinueProxyEmbeddingsProvider extends OpenAIEmbeddingsProvider {
  static providerName: EmbeddingsProviderName = "continue-proxy";
  static defaultOptions: Partial<EmbedOptions> | undefined = {
    apiBase: new URL("/model-proxy/v1", CONTROL_PLANE_URL).toString(),
  };

  private _workOsAccessToken: string | undefined = undefined;

  get workOsAccessToken(): string | undefined {
    return this._workOsAccessToken;
  }

  set workOsAccessToken(value: string | undefined) {
    if (this._workOsAccessToken !== value) {
      this._workOsAccessToken = value;
      this.options.apiKey = value;
    }
  }
}

export default ContinueProxyEmbeddingsProvider;
