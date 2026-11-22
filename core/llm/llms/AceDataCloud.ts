import { LLMOptions } from "../../index.js";
import { DEFAULT_MAX_TOKENS } from "../constants.js";
import OpenAI from "./OpenAI.js";

/** Named provider; its adapter selects each exact model's published protocol. */
class AceDataCloud extends OpenAI {
  static providerName = "acedatacloud";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.acedata.cloud/v1/",
    useLegacyCompletionsEndpoint: false,
    useResponsesApi: false,
  };

  constructor(options: LLMOptions) {
    super({
      ...options,
      useLegacyCompletionsEndpoint: false,
      useResponsesApi: false,
    });
    // A same-named vendor entry is not a published Ace capacity guarantee.
    this._contextLength = options.contextLength;
    this.completionOptions.maxTokens =
      options.completionOptions?.maxTokens ?? DEFAULT_MAX_TOKENS;
  }

  supportsImages(): boolean {
    return this.capabilities?.uploadImage === true;
  }

  async listModels(): Promise<string[]> {
    if (!this.openaiAdapter) {
      throw new Error("Ace Data Cloud adapter is not configured");
    }
    return (await this.openaiAdapter.list()).map(({ id }) => id);
  }
}

export default AceDataCloud;
