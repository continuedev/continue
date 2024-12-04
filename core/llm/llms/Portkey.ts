import { LLMOptions, ModelProvider } from "../../index.js";
import OpenAI from "./OpenAI.js";

class Portkey extends OpenAI {
  static providerName: ModelProvider = "portkey";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.portkey.ai/v1/",
  };

  protected portkeyConfig: string;

  constructor(options: LLMOptions) {
    super(options);
    this.portkeyConfig = options.portkeyConfig || "";
  }

  protected _getHeaders() {
    return {
      ...super._getHeaders(),
      "x-portkey-config": this.portkeyConfig,
    };
  }
}

export default Portkey;