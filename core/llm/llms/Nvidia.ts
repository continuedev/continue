import { LLMOptions, ModelProvider } from "../../index.js";
import OpenAI from "./OpenAI.js";

class Nvidia extends OpenAI {
  static providerName: ModelProvider = "nvidia";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://integrate.api.nvidia.com/v1/",
    model: "meta/llama-3.1-405b-instruct",
    useLegacyCompletionsEndpoint: false,
  };
  maxStopWords: number | undefined = 4;
}

export default Nvidia;
