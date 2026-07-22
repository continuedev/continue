import { LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

class AGIone extends OpenAI {
  static providerName = "agione";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://agione.pro/hyperone/xapi/api/v1/",
    model: "openai/GPT-5.5/c6fbe",
    useLegacyCompletionsEndpoint: false,
  };

  async listModels(): Promise<string[]> {
    const modelsEndpoint = new URL("../models", this.apiBase);
    const response = await this.fetch(modelsEndpoint, {
      method: "GET",
      headers: this._getHeaders(),
    });

    const data = await response.json();
    const models = Array.isArray(data) ? data : (data.data ?? []);
    return models.map((m: any) => m.id);
  }
}

export default AGIone;
