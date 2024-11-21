import { LLMOptions, ModelProvider } from "../../index.js";
import { osModelsEditPrompt } from "../templates/edit.js";

import OpenAI from "./OpenAI.js";

class SiliconFlow extends OpenAI {
  static providerName: ModelProvider = "siliconflow";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.siliconflow.cn/v1",
    model: "Qwen/Qwen2.5-Coder-32B-Instruct",
    promptTemplates: {
      edit: osModelsEditPrompt,
    },
    useLegacyCompletionsEndpoint: false,
  };
  maxStopWords: number | undefined = 16;

  supportsFim(): boolean {
    return true;
  }

  _getFimEndpoint(endpoint: string) {
    return new URL("chat/completions", this.apiBase);
  }
  
}

export default SiliconFlow;
