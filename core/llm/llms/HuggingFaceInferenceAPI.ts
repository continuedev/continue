import { LLM } from "..";
import { ModelProvider } from "../../config";
import { ChatMessage, CompletionOptions } from "../types";

class HuggingFaceInferenceAPI extends LLM {
  static providerName: ModelProvider = "huggingface-inference-api";

  private _convertArgs(options: CompletionOptions, prompt: string) {
    const finalOptions = {};

    return finalOptions;
  }

  protected async _complete(
    prompt: string,
    options: CompletionOptions
  ): Promise<string> {
    throw new Error("Method not implemented.");
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions
  ): AsyncGenerator<string> {
    throw new Error("Method not implemented.");
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions
  ): AsyncGenerator<ChatMessage> {
    throw new Error("Method not implemented.");
  }
}

export default HuggingFaceInferenceAPI;
