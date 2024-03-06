import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  ModelProvider,
} from "../..";

import OpenAI from "./OpenAI";

class Together extends OpenAI {
  static providerName: ModelProvider = "together";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.together.xyz/v1",
  };

  private static MODEL_IDS: { [name: string]: string } = {
    "codellama-7b": "togethercomputer/CodeLlama-7b-Instruct",
    "codellama-13b": "togethercomputer/CodeLlama-13b-Instruct",
    "codellama-34b": "togethercomputer/CodeLlama-34b-Instruct",
    "codellama-70b": "codellama/CodeLlama-70b-Instruct-hf",
    "llama2-7b": "togethercomputer/llama-2-7b-chat",
    "llama2-13b": "togethercomputer/llama-2-13b-chat",
    "llama2-70b": "togethercomputer/llama-2-70b-chat",
    "mistral-7b": "mistralai/Mistral-7B-Instruct-v0.1",
    "mistral-8x7b": "mistralai/Mixtral-8x7B-Instruct-v0.1",
    "phind-codellama-34b": "Phind/Phind-CodeLlama-34B-v2",
    "wizardcoder-34b": "WizardLM/WizardCoder-Python-34B-V1.0",
  };

  private _getModelName(model: string) {
    return Together.MODEL_IDS[model] || this.model;
  }

  protected _convertArgs(options: any, messages: ChatMessage[]) {
    const finalOptions = super._convertArgs(options, messages);
    finalOptions.model = this._getModelName(options.model);
    return finalOptions;
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    for await (const chunk of this._legacystreamComplete(prompt, options)) {
      yield chunk;
    }
  }
}

export default Together;
