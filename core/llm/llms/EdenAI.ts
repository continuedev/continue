import { LLMOptions } from "../../index.js";
import { osModelsEditPrompt } from "../templates/edit.js";

import OpenAI from "./OpenAI.js";

/**
 * Eden AI (https://www.edenai.co) is an OpenAI-compatible aggregator that
 * provides unified access to 100+ models from many providers (OpenAI,
 * Anthropic, Google, Mistral, DeepSeek, and more) through a single EU-hosted
 * endpoint and API key. Models use the `provider/model` naming scheme, e.g.
 * `anthropic/claude-sonnet-4-5` or `mistral/codestral-latest`.
 */
class EdenAI extends OpenAI {
  static providerName = "edenai";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.edenai.run/v3/",
    model: "anthropic/claude-sonnet-4-5",
    promptTemplates: {
      edit: osModelsEditPrompt,
    },
    useLegacyCompletionsEndpoint: false,
  };
}

export default EdenAI;
