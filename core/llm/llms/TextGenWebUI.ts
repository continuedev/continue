import { LLMOptions, ModelProvider } from "../..";
import OpenAI from "./OpenAI";

class TextGenWebUI extends OpenAI {
  static providerName: ModelProvider = "text-gen-webui";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "http://localhost:5000",
  };
}

export default TextGenWebUI;
