import { LLMOptions, ModelProvider, ChatMessage } from "../../index.js";

import OpenAI from "./OpenAI.js";

class Nvidia extends OpenAI {
  // NVIDIA NIMs currently limits the number of stops for Starcoder 2 to 4
  // https://docs.api.nvidia.com/nim/reference/bigcode-starcoder2-7b-infer
  protected maxStopWordsStarCoder = 4;
  static providerName: ModelProvider = "nvidia";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://integrate.api.nvidia.com/v1/",
    useLegacyCompletionsEndpoint: false,
  };

  protected _convertArgs(options: any, messages: ChatMessage[]) {
    const url = new URL(this.apiBase!);
    const finalOptions = {
      messages: messages.map(this._convertMessage),
      model: this._convertModelName(options.model),
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      top_p: options.topP,
      frequency_penalty: options.frequencyPenalty,
      presence_penalty: options.presencePenalty,
      stop: options.model.includes("starcoder2")
        ? options.stop?.slice(0, this.maxStopWordsStarCoder)
        : options.stop,
    };

    return finalOptions;
  }
}

export default Nvidia;
