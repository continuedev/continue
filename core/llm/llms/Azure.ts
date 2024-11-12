import { LLMOptions, ModelProvider } from "../../index.js";

import OpenAI from "./OpenAI.js";

class Azure extends OpenAI {
  static providerName: ModelProvider = "azure";

  static defaultOptions: Partial<LLMOptions> = {
    apiVersion: "2024-02-15-preview",
    apiType: "azure",
  };

  constructor(options: LLMOptions) {
    super(options);
    this.deployment = options.deployment ?? options.model;
  }
}

export default Azure;
