import { LLMOptions } from "..";
import { ModelProvider } from "../../config";
import OpenAI from "./OpenAI";

class Mistral extends OpenAI {
  static providerName: ModelProvider = "mistral";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.mistral.ai/v1",
  };
}

export default Mistral;
