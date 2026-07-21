import { LLMOptions } from "../../index.js";
import { osModelsEditPrompt } from "../templates/edit.js";

import OpenAI from "./OpenAI.js";

/**
 * CrossModel LLM provider.
 *
 * CrossModel (https://crossmodel.ai) is an OpenAI- and Anthropic-compatible
 * multi-provider API gateway. A single API key and base URL routes to models
 * from OpenAI, Anthropic, DeepSeek, Gemini, Qwen, Kimi, GLM and more, with
 * unified billing and usage tracking.
 *
 * Uses the OpenAI-compatible Chat Completions API. The available models can be
 * listed dynamically from the gateway's `/v1/models` endpoint, so users can
 * fetch the current catalog after entering their API key.
 *
 * @see https://crossmodel.ai/docs
 */
class CrossModel extends OpenAI {
  static providerName = "crossmodel";

  // CrossModel routes to reasoning-capable models and surfaces their
  // reasoning content over the OpenAI-compatible wire format.
  protected supportsReasoningField = true;
  protected supportsReasoningDetailsField = true;

  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.crossmodel.ai/v1/",
    model: "anthropic/claude-sonnet-4-6",
    promptTemplates: {
      edit: osModelsEditPrompt,
    },
    useLegacyCompletionsEndpoint: false,
  };
}

export default CrossModel;
