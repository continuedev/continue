import { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions";
import { ModelProvider } from "../../config";
import { ChatMessage } from "../types";
import OpenAI from "./OpenAI";

class LMStudio extends OpenAI {
  static providerName: ModelProvider = "lmstudio";
  static defaultOptions = {
    apiBase: "http://localhost:1234/v1",
  };
}

export default LMStudio;
