import type { LLMOptions, ModelProvider } from "../../..";
import OpenAI from "../OpenAI.js";

class ContinueProxy extends OpenAI {
  private _workOsAccessToken: string | undefined = undefined;

  get workOsAccessToken(): string | undefined {
    return this._workOsAccessToken;
  }

  set workOsAccessToken(value: string | undefined) {
    if (this._workOsAccessToken !== value) {
      this._workOsAccessToken = value;
      this.apiKey = value;
    }
  }
  static providerName: ModelProvider = "continue-proxy";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase:
      "https://control-plane-api-service-i3dqylpbqa-uc.a.run.app/model-proxy/v1",
  };

  supportsFim(): boolean {
    return true;
  }
}

export default ContinueProxy;
