import { LLMOptions } from "../../index.js";
import OpenAI from "./OpenAI.js";

/** Named Chat Completions provider; model IDs are sent without translation. */
class AceDataCloud extends OpenAI {
  static providerName = "acedatacloud";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.acedata.cloud/v1/",
    useLegacyCompletionsEndpoint: false,
    useResponsesApi: false,
  };

  constructor(options: LLMOptions) {
    super({ ...options, useResponsesApi: false });
  }
}

export default AceDataCloud;
