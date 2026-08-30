import Ollama from "./Ollama";

import type { LLMOptions } from "../../index.js";

/**
 * llmman (https://github.com/llmmanorg/llmman) is a local model runner that
 * serves the Ollama API, so it reuses that implementation wholesale and only
 * changes the provider name and the default port it listens on.
 */
class Llmman extends Ollama {
  static providerName = "llmman";
  static defaultOptions: Partial<LLMOptions> = {
    ...Ollama.defaultOptions,
    apiBase: "http://localhost:17434/",
  };
}

export default Llmman;
