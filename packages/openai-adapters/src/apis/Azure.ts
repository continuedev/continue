import { OpenAI } from "openai/index";
import {
  ChatCompletionChunk,
  ChatCompletionCreateParams,
  ChatCompletionCreateParamsStreaming,
} from "openai/resources/index";
import { z } from "zod";
import { AzureConfigSchema } from "../types.js";
import { customFetch } from "../util.js";
import { OpenAIApi } from "./OpenAI.js";

export class AzureApi extends OpenAIApi {
  constructor(private azureConfig: z.infer<typeof AzureConfigSchema>) {
    super({
      ...azureConfig,
      provider: "openai",
    });

    const { baseURL, defaultQuery } = this._getAzureBaseURL(azureConfig);

    this.openai = new OpenAI({
      apiKey: azureConfig.apiKey,
      baseURL,
      fetch: customFetch(azureConfig.requestOptions),
      defaultQuery,
    });
  }

  /**
   * Default is `azure-openai`, but previously was `azure`
   * @param apiType
   * @returns
   */
  private _isAzureOpenAI(apiType?: string): boolean {
    return apiType === "azure-openai" || apiType === "azure";
  }

  private _getAzureBaseURL(config: z.infer<typeof AzureConfigSchema>): {
    baseURL: string;
    defaultQuery: Record<string, string>;
  } {
    const url = new URL(this.apiBase);

    // Copy search params to separate object for OpenAI
    const queryParams: Record<string, string> = {};
    for (const [key, value] of url.searchParams.entries()) {
      queryParams[key] = value;
    }

    url.pathname = url.pathname.replace(/\/$/, ""); // Remove trailing slash if present
    url.search = ""; // Clear original search params

    // Default is `azure-openai` in docs, but previously was `azure`
    if (this._isAzureOpenAI(config.env?.apiType)) {
      if (!config.env?.deployment) {
        throw new Error(
          "`env.deployment` is a required configuration property for Azure OpenAI",
        );
      }

      if (!config.env?.apiVersion) {
        throw new Error(
          "`env.apiVersion` is a required configuration property for Azure OpenAI",
        );
      }

      const basePathname = `openai/deployments/${config.env.deployment}`;

      url.pathname =
        url.pathname === "/" ? basePathname : `${url.pathname}/${basePathname}`;

      queryParams["api-version"] = config.env.apiVersion;
    }

    return {
      baseURL: url.toString(),
      defaultQuery: queryParams,
    };
  }

  /**
   * Filters out empty text content parts from messages.
   *
   * Azure models may not support empty content parts, which can cause issues.
   * This function removes any text content parts that are empty or contain only whitespace.
   */
  private _filterEmptyContentParts<T extends ChatCompletionCreateParams>(
    body: T,
  ): T {
    const result = { ...body };

    result.messages = result.messages.map((message: any) => {
      if (Array.isArray(message.content)) {
        const filteredContent = message.content.filter((part: any) => {
          return !(
            part.type === "text" &&
            (!part.text || part.text.trim() === "")
          );
        });
        return {
          ...message,
          content:
            filteredContent.length > 0 ? filteredContent : message.content,
        };
      }
      return message;
    }) as any;

    return result;
  }

  modifyChatBody<T extends ChatCompletionCreateParams>(body: T): T {
    let modifiedBody = super.modifyChatBody(body);
    modifiedBody = this._filterEmptyContentParts(modifiedBody);
    return modifiedBody;
  }

  async *chatCompletionStream(
    body: ChatCompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk, any, unknown> {
    const response = await this.openai.chat.completions.create(
      this.modifyChatBody(body),
      { signal },
    );

    for await (const result of response) {
      // Skip chunks with no choices (common with Azure content filtering)
      if (result.choices && result.choices.length > 0) {
        yield result;
      }
    }
  }
}
