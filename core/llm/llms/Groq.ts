import { LLMOptions, ModelProvider } from "../../index.js";
import OpenAI from "./OpenAI.js";

class Groq extends OpenAI {
  static providerName: ModelProvider = "groq";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.groq.com/openai/v1/",
  };
  maxStopWords: number | undefined = 4;

  private static modelConversion: { [key: string]: string } = {
    "llama2-70b": "llama2-70b-4096",
    "mistral-8x7b": "mixtral-8x7b-32768",
    gemma: "gemma-7b-it",
    gemma2: "gemma2-9b-it",
    "llama3-8b": "llama3-8b-8192",
    "llama3-70b": "llama3-70b-8192",
    "llama3.1-8b": "llama-3.1-8b-instant",
    "llama3.1-70b": "llama-3.1-70b-versatile",
    "llama3.1-405b": "llama-3.1-405b-reasoning",
  };
  protected _convertModelName(model: string): string {
    return Groq.modelConversion[model] ?? model;
  }
}

export default Groq;
