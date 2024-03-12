import { LLMOptions, ModelProvider } from "../..";
import OpenAI from "./OpenAI";

class DeepInfra extends OpenAI {
  static providerName: ModelProvider = "deepinfra";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.deepinfra.com/v1/openai/",
  };
}

export default DeepInfra;
