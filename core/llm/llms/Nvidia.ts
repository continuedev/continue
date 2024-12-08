import { LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

class Nvidia extends OpenAI {
  // NVIDIA NIMs currently limits the number of stops for Starcoder 2 to 4
  // https://docs.api.nvidia.com/nim/reference/bigcode-starcoder2-7b-infer
  maxStopWords = 4;
  static providerName = "nvidia";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://integrate.api.nvidia.com/v1/",
    useLegacyCompletionsEndpoint: false,
  };
}

export default Nvidia;
