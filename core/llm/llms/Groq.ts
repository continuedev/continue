import { LLMOptions, ModelProvider } from "../..";
import OpenAI from "./OpenAI";

class Groq extends OpenAI {
  static providerName: ModelProvider = "groq";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.groq.com/openai/v1/",
  };

  private static modelConversion: { [key: string]: string } = {
    "llama2-70b": "llama2-70b-4096",
    "mistral-8x7b": "mixtral-8x7b-32768",
    gemma: "gemma-7b-it",
  };
  protected _convertModelName(model: string): string {
    return Groq.modelConversion[model] ?? model;
  }
}

export default Groq;
