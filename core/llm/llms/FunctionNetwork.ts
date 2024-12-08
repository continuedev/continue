import { LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

class FunctionNetwork extends OpenAI {
  static providerName = "function-network";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.function.network/v1/",
    model: "meta/llama-3.1-70b-instruct",
  };

  private static modelConversion: { [key: string]: string } = {
    "mistral-7b": "mistral/mistral-7b-instruct-v0.1",
    "llama3-8b": "meta/llama-3-8b-instruct",
    "llama3.1-8b": "meta/llama-3.1-8b-instruct",
    "llama3.1-70b": "meta/llama-3.1-70b-instruct",
    "deepseek-7b": "thebloke/deepseek-coder-6.7b-instruct-awq",
  };

  constructor(options: LLMOptions) {
    super(options);
  }

  protected _convertModelName(model: string): string {
    return FunctionNetwork.modelConversion[model] ?? model;
  }

  public supportsFim(): boolean {
    return false;
  }

  public supportsCompletions(): boolean {
    return false;
  }

  public supportsPrefill(): boolean {
    return false;
  }
}

export default FunctionNetwork;
