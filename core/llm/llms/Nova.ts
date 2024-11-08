import { LLMOptions, ModelProvider } from "../../index.js";
import OpenAI from "./OpenAI.js";

class Nova extends OpenAI {
  static providerName: ModelProvider = "nova";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://nova.oasis.mountainxplorer.ai/model-api/",
  };

  constructor(options: LLMOptions) {
    super(options);
  }
}

export default Nova;
