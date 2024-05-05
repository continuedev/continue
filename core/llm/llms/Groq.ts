import type { LLMOptions, ModelProvider } from "../..";
import OpenAI from "./OpenAI";

class Groq extends OpenAI {
  static providerName: ModelProvider = "groq";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.groq.com/openai/v1/",
  };
  protected maxStopWords: number | undefined = 4;

  private static modelConversion: { [key: string]: string } = {
    "llama2-70b": "llama2-70b-4096",
    "mistral-8x7b": "mixtral-8x7b-32768",
    gemma: "gemma-7b-it",
    "llama3-8b": "llama3-8b-8192",
    "llama3-70b": "llama3-70b-8192",
  };
  protected _convertModelName(model: string): string {
    return Groq.modelConversion[model] ?? model;
  }
}

export default Groq;
