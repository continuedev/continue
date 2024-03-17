import { LLMOptions, ModelProvider } from "../..";
import OpenAI from "./OpenAI";

class Mistral extends OpenAI {
  static providerName: ModelProvider = "mistral";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.mistral.ai/v1/",
    model: "mistral-small",
  };
}

export default Mistral;
