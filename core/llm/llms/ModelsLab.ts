import type { CompletionOptions, LLMOptions } from "../../index.js";
import OpenAI from "./OpenAI.js";

/**
 * ModelsLab provider for Continue.
 *
 * Provides uncensored Llama 3.1 language models via ModelsLab's
 * OpenAI-compatible API endpoint. Ideal for code assistance,
 * creative writing, and unrestricted use cases with a 128K context window.
 *
 * Configuration example (`config.json`):
 * ```json
 * {
 *   "models": [{
 *     "title": "ModelsLab Llama 3.1 8B",
 *     "provider": "modelslab",
 *     "model": "llama-3.1-8b-uncensored",
 *     "apiKey": "YOUR_MODELSLAB_API_KEY"
 *   }]
 * }
 * ```
 *
 * Get your API key at: https://modelslab.com
 * API docs: https://docs.modelslab.com/uncensored-chat
 */
class ModelsLab extends OpenAI {
  static providerName = "modelslab";

  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://modelslab.com/uncensored-chat/v1/",
    model: "llama-3.1-8b-uncensored",
  };

  /**
   * Map Continue's short model names to ModelsLab model IDs.
   * Users can also pass the full model ID directly.
   */
  private static readonly MODEL_IDS: Record<string, string> = {
    // Short aliases (Continue convention)
    "llama3.1-8b": "llama-3.1-8b-uncensored",
    "llama3.1-70b": "llama-3.1-70b-uncensored",
    // Full IDs (pass-through)
    "llama-3.1-8b-uncensored": "llama-3.1-8b-uncensored",
    "llama-3.1-70b-uncensored": "llama-3.1-70b-uncensored",
  };

  protected _convertModelName(model: string): string {
    return ModelsLab.MODEL_IDS[model] ?? model;
  }

  // ModelsLab's streaming uses the standard SSE format — inherited from OpenAI.
  // No overrides needed for _streamChat or _streamComplete.
}

export default ModelsLab;
