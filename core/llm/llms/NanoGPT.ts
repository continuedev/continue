import { LLMOptions } from "../../index.js";
import OpenAI from "./OpenAI.js";

class NanoGPT extends OpenAI {
  static providerName = "nanogpt";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://nano-gpt.com/api/v1/",
    model: "deepseek/deepseek-v4.1-flash",
    useLegacyCompletionsEndpoint: false,
  };
}

export default NanoGPT;
