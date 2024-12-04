import { LLMOptions, ModelProvider } from "../../index.js";
import OpenAI from "./OpenAI.js";

class Portkey extends OpenAI {
  private configId: string | undefined;

  constructor(options: LLMOptions) {
    super(options);
    this.configId = options.portkeyConfigId;
  }

  static providerName: ModelProvider = "portkey";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.portkey.ai/v1/",
  };

  protected _getHeaders() {
    return {
      ...super._getHeaders(),
      "X-Portkey-Api-Key": this.apiKey,
      "X-Portkey-Config-Id": this.configId,
      "Content-Type": "application/json",
    };
  }
}

export default Portkey;