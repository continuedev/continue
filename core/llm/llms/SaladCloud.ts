import { ChatCompletionCreateParams } from "openai/resources/index";
import { ChatMessage, CompletionOptions, LLMOptions } from "../..";

import OpenAI from "./OpenAI";

class SaladCloud extends OpenAI {
  static providerName = "saladcloud";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://ai.salad.cloud/v1/",
    useLegacyCompletionsEndpoint: false,
  };

  protected _convertArgs(
    options: CompletionOptions,
    messages: ChatMessage[],
  ): ChatCompletionCreateParams {
    return this.addDefaultChatTemplateKwargs(
      super._convertArgs(options, messages),
    );
  }

  protected modifyChatBody(
    body: ChatCompletionCreateParams,
  ): ChatCompletionCreateParams {
    return this.addDefaultChatTemplateKwargs(super.modifyChatBody(body));
  }

  private addDefaultChatTemplateKwargs(
    body: ChatCompletionCreateParams,
  ): ChatCompletionCreateParams {
    const extendedBody = body as ChatCompletionCreateParams & {
      chat_template_kwargs?: Record<string, unknown>;
    };
    const existingKwargs =
      extendedBody.chat_template_kwargs &&
      typeof extendedBody.chat_template_kwargs === "object" &&
      !Array.isArray(extendedBody.chat_template_kwargs)
        ? extendedBody.chat_template_kwargs
        : {};

    extendedBody.chat_template_kwargs = {
      enable_thinking: false,
      ...existingKwargs,
    };

    return extendedBody;
  }
}

export default SaladCloud;
