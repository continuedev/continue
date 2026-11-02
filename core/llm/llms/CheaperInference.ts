import type { LLMOptions } from "../../index.js";
import OpenAI from "./OpenAI.js";

interface CheaperInferenceModel {
  id: string;
  supported_endpoints: string[];
}

class CheaperInference extends OpenAI {
  static providerName = "cheaper-inference";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.cheaperinference.com/v1/",
    useLegacyCompletionsEndpoint: false,
  };

  protected supportsReasoningContentField = true;

  async listModels(): Promise<string[]> {
    const url = this._getEndpoint("models");
    url.searchParams.set("type", "text");
    const response = await this.fetch(url, {
      method: "GET",
      headers: this._getHeaders(),
    });
    const { data } = (await response.json()) as {
      data: CheaperInferenceModel[];
    };
    return data
      .filter((model) =>
        model.supported_endpoints.includes("/v1/chat/completions"),
      )
      .map((model) => model.id);
  }
}

export default CheaperInference;
