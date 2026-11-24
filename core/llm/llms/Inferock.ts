import { ChatCompletionCreateParams } from "openai/resources/index";

import {
  normalizeInferockApiBase,
  sanitizeDaneRequestBody,
} from "@continuedev/openai-adapters";

import { ChatMessage, CompletionOptions, LLMOptions } from "../../index.js";
import { LlmApiRequestType } from "../openaiTypeConverters.js";

import OpenAI from "./OpenAI.js";

class Inferock extends OpenAI {
  static providerName = "inferock";
  static defaultOptions: Partial<LLMOptions> = {
    model: "dane",
    contextLength: 1_000_000,
    useLegacyCompletionsEndpoint: false,
  };

  protected useOpenAIAdapterFor: (LlmApiRequestType | "*")[] = [
    "chat",
    "list",
    "streamChat",
  ];

  private readonly inferockExtraBodyProperties?: Record<string, unknown>;

  constructor(options: LLMOptions) {
    const existingHeaders = options.requestOptions?.headers ?? {};
    const hasGovHeader = Object.keys(existingHeaders).some(
      (k) => k.toLowerCase() === "x-governance-provider",
    );
    const { extraBodyProperties, ...restRequestOptions } =
      options.requestOptions ?? {};
    super({
      ...options,
      apiBase: normalizeInferockApiBase(options.apiBase),
      requestOptions: {
        ...restRequestOptions,
        headers: {
          ...(hasGovHeader ? {} : { "x-governance-provider": "inferock-serve" }),
          ...existingHeaders,
        },
      },
    });
    this.inferockExtraBodyProperties = extraBodyProperties;
  }

  supportsCompletions(): boolean {
    return false;
  }

  private mergeAndSanitize(
    body: ChatCompletionCreateParams,
  ): ChatCompletionCreateParams {
    const merged = this.inferockExtraBodyProperties
      ? ({
          ...body,
          ...this.inferockExtraBodyProperties,
        } as Record<string, unknown>)
      : (body as unknown as Record<string, unknown>);
    if (merged.model === "dane") {
      sanitizeDaneRequestBody(merged);
    }
    return merged as unknown as ChatCompletionCreateParams;
  }

  protected modifyChatBody(
    body: ChatCompletionCreateParams,
  ): ChatCompletionCreateParams {
    return this.mergeAndSanitize(super.modifyChatBody(body));
  }

  protected _convertArgs(options: CompletionOptions, messages: ChatMessage[]) {
    return this.mergeAndSanitize(super._convertArgs(options, messages));
  }
}

export default Inferock;
