import { LLMOptions } from "../../index.js";
import { LlmApiRequestType } from "../openaiTypeConverters.js";

import OpenAI from "./OpenAI.js";

/**
 * Fantastico mints a short-lived runtime key from the user's account key and
 * then calls the model provider directly. The key exchange lives in the
 * openai-adapters FantasticoApi, so every request goes through the adapter.
 */
class Fantastico extends OpenAI {
  static providerName = "fantastico";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://fantastico.cc/api/",
    useLegacyCompletionsEndpoint: false,
  };

  protected useOpenAIAdapterFor: (LlmApiRequestType | "*")[] = ["*"];

  /**
   * The catalog is served by the control plane, not by the inference endpoint:
   * account keys read it from `/edge/models`, project keys from `/runtime/models`.
   */
  async listModels(): Promise<string[]> {
    const route = this.apiKey?.startsWith("sk-fant-") ? "runtime" : "edge";
    const controlPlane = (this.apiBase ?? "").replace(/\/+$/, "");
    const response = await this.fetch(`${controlPlane}/${route}/models`, {
      method: "GET",
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    const data = (await response.json()) as { models?: { id: string }[] };
    return (data.models ?? []).map((m) => m.id);
  }
}

export default Fantastico;
