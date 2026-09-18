import { LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

class GitGot extends OpenAI {
  static providerName = "gitgot";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://inference.gitgot.ai/v1/",
    model: "openai/gpt-oss-120b",
    useLegacyCompletionsEndpoint: false,
  };
}

export default GitGot;
