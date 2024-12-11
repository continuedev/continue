import { ChatCompletionCreateParams } from "@continuedev/openai-adapters";
import { ChatMessage, CompletionOptions, LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

class Portkey extends OpenAI {
  static providerName: string = "portkey";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.portkey.ai/v1/",
  };

  protected portkeyConfig: string;

  constructor(options: LLMOptions) {
    super(options);
    this.portkeyConfig = options.portkeyConfigId || "";
  }

  protected _getHeaders() {
    return {
      ...super._getHeaders(),
      "x-portkey-config": this.portkeyConfig,
      "x-portkey-api-key": this.apiKey,
      "Content-Type": "application/json",
    };
  }

  protected _convertArgs(
    options: CompletionOptions,
    messages: ChatMessage[],
  ): ChatCompletionCreateParams {
    const args = super._convertArgs(options, messages);
    // @ts-expect-error
    args.model = undefined;
    return args;
  }

  // Show configId
  async listModels(): Promise<string[]> {
    return [this.portkeyConfig];
  }
}

export default Portkey;
