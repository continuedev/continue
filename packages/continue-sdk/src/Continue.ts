import { decodePackageSlug } from "@continuedev/config-yaml";
import type { OpenAI } from "openai";
import { DefaultApi } from "../clients/typescript/src/apis/DefaultApi.js";
import { Configuration } from "../clients/typescript/src/index.js";
import { Assistant } from "./Assistant.js";
import { createOpenAIClient } from "./createOpenAIClient.js";

export interface ContinueClientOptions {
  /**
   * The assistant identifier in the format owner-slug/package-slug
   */
  assistant: string;

  /**
   * API Key Authentication
   *
   * API keys must be prefixed with "con_" and provided in the Authorization header.
   * Example: `Authorization: Bearer con_your_api_key_here`
   *
   * API keys can be generated in the Continue Hub web interface under account settings.
   */
  apiKey: string;

  /**
   * Optional organization ID
   *
   * TODO: This should be an org name, not the UUID
   */
  organizationId?: string;

  /**
   * Base URL for the Continue API
   */
  baseURL?: string;
}

export type ContinueResult = {
  /**
   * The Continue API client
   */
  api: DefaultApi;

  /**
   * The OpenAI client configured to use the Continue API
   */
  client: OpenAI;

  /**
   * The full YAML configuration for the assistant, along
   * with some additional utility methods
   */
  assistant: Assistant;
};

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
