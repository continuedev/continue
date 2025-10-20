import { LLMOptions } from "../../index.js";
import OpenAI from "./OpenAI.js";

class Stakd extends OpenAI {
  static providerName = "stakd";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "http://localhost:8080/v1/",
    model: "stakd-backend",
    useLegacyCompletionsEndpoint: false,
  };

  protected useOpenAIAdapterFor: (
    | "*"
    | import("../openaiTypeConverters.js").LlmApiRequestType
  )[] = ["chat", "embed", "list", "rerank", "streamChat", "streamFim"];
}

export default Stakd;
