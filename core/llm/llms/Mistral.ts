import { LLMOptions, ModelProvider } from "../../index.js";
import OpenAI from "./OpenAI.js";

class Mistral extends OpenAI {
  static providerName: ModelProvider = "mistral";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.mistral.ai/v1/",
    model: "mistral-small",
  };
}

export default Mistral;
