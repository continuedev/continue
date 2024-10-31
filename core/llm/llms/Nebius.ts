import { LLMOptions, ModelProvider } from "../..";
import OpenAI from "./OpenAI";

class Nebius extends OpenAI {
  static providerName: ModelProvider = "nvidia";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.studio.nebius.ai/v1/",
    useLegacyCompletionsEndpoint: false,
  };
}

export default Nebius;
