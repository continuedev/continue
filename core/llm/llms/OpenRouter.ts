import { LLMOptions } from "../../index.js";
import { osModelsEditPrompt } from "../templates/edit.js";

import OpenAI from "./OpenAI.js";

class OpenRouter extends OpenAI {
  static providerName = "openrouter";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://openrouter.ai/api/v1/",
    model: "gpt-4o-mini",
    promptTemplates: {
      edit: osModelsEditPrompt,
    },
    useLegacyCompletionsEndpoint: false,
  };

  constructor(options: LLMOptions) {
    super(options);
    
    // Disable tool use for free tier models that don't support it
    if (this.model.endsWith(":free")) {
      if (this.capabilities) {
        this.capabilities.tools = false;
      } else {
        this.capabilities = { tools: false };
      }
      console.warn(
         `Tool use disabled for model ${this.model} as it does not support it. Use non-free variant for full capabilities.`,
       );
    }
  }
}

export default OpenRouter;
