import { decodePackageSlug } from "@continuedev/config-yaml";
import type { OpenAI } from "openai";
import { Configuration } from "../clients/typescript/src";
import { DefaultApi } from "../clients/typescript/src/apis/DefaultApi";
import { Assistant } from "./Assistant";
import { createOpenAIClient } from "./createOpenAIClient";

export interface ContinueClientOptions {
  apiKey?: string;
  organizationId?: string;
  assistant?: string;
  baseURL?: string;
}

/**
 * Result from Continue.from() containing configured clients
 */
export type ContinueResult = {
  /**
   * The Continue API client
   */
  api: DefaultApi;
} & (
  | {
      client: OpenAI;
      assistant: Assistant;
    }
  | {
      client?: undefined;
      assistant?: undefined;
    }
);

export class Continue {
  /**
   * Create a Continue instance with pre-configured OpenAI client and assistant
   *
   * @param options - Configuration options
   * @returns Object containing Continue client, OpenAI client, and assistant config
   */
  static async from(options: ContinueClientOptions): Promise<ContinueResult> {
    const baseURL = options.baseURL || "https://api.continue.dev/";

    const api = new DefaultApi(
      new Configuration({
        basePath: baseURL,
        accessToken: options.apiKey
          ? async () => options.apiKey as string
          : undefined,
      }),
    );

    if (!options.assistant) {
      return {
        api,
      };
    }

    const { ownerSlug, packageSlug } = decodePackageSlug(options.assistant);
    if (!ownerSlug || !packageSlug) {
      throw new Error(
        `Invalid assistant identifier: ${options.assistant}. Expected format: owner-slug/package-slug`,
      );
    }

    const assistants = await api.listAssistants({
      organizationId: options.organizationId,
      alwaysUseProxy: "true",
    });

    const assistantRes = assistants.find(
      (a) => a.ownerSlug === ownerSlug && a.packageSlug === packageSlug,
    );

    if (!assistantRes) {
      throw new Error(`Assistant ${options.assistant} not found`);
    }

    const assistant = new Assistant(assistantRes.configResult.config);

    const client = createOpenAIClient({
      models: assistant.config.models,
      organizationId: options.organizationId || null,
      apiKey: options.apiKey,
      baseURL: baseURL,
    });

    return {
      api,
      client,
      assistant,
    };
  }
}
