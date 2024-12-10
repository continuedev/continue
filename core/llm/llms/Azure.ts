import { LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

class Azure extends OpenAI {
  static providerName = "azure";

  protected supportsPrediction(model: string): boolean {
    return false;
  }

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
