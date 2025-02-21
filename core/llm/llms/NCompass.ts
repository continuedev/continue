import { LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

class NCompass extends OpenAI {
  static providerName = "ncompass";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.ncompass.tech/v1",
  };

  private static modelConversion: { [key: string]: string } = {
    "qwen2.5-coder-32b": "Qwen/Qwen2.5-Coder-32B-Instruct",
    "qwen2.5-72b": "Qwen/Qwen2.5-72B-Instruct",
    "llama3.3-70b": "meta-llama/Meta-Llama-3.3-70B-Instruct",
  };
  protected _convertModelName(model: string): string {
    return NCompass.modelConversion[model] ?? model;
  }
}

export default NCompass;
