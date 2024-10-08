import { LLMOptions, ModelProvider } from "../../index.js";
import OpenAI from "./OpenAI.js";

class Cerebras extends OpenAI {
  static providerName: ModelProvider = "cerebras";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.cerebras.ai/v1/",
  };
  maxStopWords: number | undefined = 4;

  private static modelConversion: { [key: string]: string } = {
    "llama3.1-8b": "llama3.1-8b",
    "llama3.1-70b": "llama3.1-70b",
  };
  protected _convertModelName(model: string): string {
    return Cerebras.modelConversion[model] ?? model;
  }
}

export default Cerebras;
