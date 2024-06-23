import type { LLMOptions, ModelProvider } from "../../..";
import OpenAI from "../OpenAI.js";

class ContinueProxy extends OpenAI {
  static providerName: ModelProvider = "continue-proxy";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "http://localhost:3000/proxy/v1",
  };

  supportsFim(): boolean {
    return true;
  }
}

export default ContinueProxy;
