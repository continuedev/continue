import { ChatMessage, CompletionOptions, LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

class MiniMax extends OpenAI {
  static providerName = "minimax";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.minimax.io/v1/",
    model: "MiniMax-M2.7",
    useLegacyCompletionsEndpoint: false,
  };

  protected _convertArgs(options: CompletionOptions, messages: ChatMessage[]) {
    const finalOptions = super._convertArgs(options, messages);

    // MiniMax requires temperature in (0.0, 1.0] — zero is rejected
    if (
      finalOptions.temperature !== undefined &&
      finalOptions.temperature !== null
    ) {
      if (finalOptions.temperature <= 0) {
        finalOptions.temperature = 0.01;
      } else if (finalOptions.temperature > 1) {
        finalOptions.temperature = 1.0;
      }
    }

    // MiniMax does not support response_format
    if ((finalOptions as any).response_format) {
      delete (finalOptions as any).response_format;
    }

    return finalOptions;
  }
}

export default MiniMax;
