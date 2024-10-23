import { GoogleAuth } from "google-auth-library";
import { LLMOptions } from "../../index.js";
import { BaseLLM } from "../index.js";
import { CompletionOptions } from "@continuedev/config-types";

abstract class VertexAI extends BaseLLM {
  declare apiBase: string;

  private clientPromise = new GoogleAuth({
    scopes: "https://www.googleapis.com/auth/cloud-platform",
  }).getClient();

  private static getDefaultApiBaseFrom(options: LLMOptions) {
    const { region, projectId } = options;
    if (!region || !projectId) {
      throw new Error(
        "region and projectId must be defined if apiBase is not provided",
      );
    }
    return `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/`;
  }

  constructor(_options: LLMOptions) {
    super(_options);
    this.apiBase ??= VertexAI.getDefaultApiBaseFrom(_options);
  }

  async fetch(url: RequestInfo | URL, init?: RequestInit) {
    const client = await this.clientPromise;
    const { token } = await client.getAccessToken();
    if (!token) {
      throw new Error(
        "Could not get an access token. Set up your Google Application Default Credentials.",
      );
    }
    return await super.fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init?.headers,
      },
    });
  }
  
  supportsFim(): boolean {
    return true;
  }

  protected async *_streamFim(
    prefix: string,
    suffix: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const endpoint = new URL("publishers/google/models/code-gecko:predict", this.apiBase);
    const resp = await this.fetch(endpoint, {
      method: "POST",
      body: JSON.stringify({
        instances: [
          {prefix: prefix,
            suffix: suffix
          }
        ],
        parameters: {
          temperature: options.temperature,
          maxOutputTokens: Math.min(options.maxTokens ?? 64,64),
          stopSequences: options.stop?.splice(0,5),
          frequencyPenalty: options.frequencyPenalty,
          presencePenalty: options.frequencyPenalty,
        }

      }),
    });
    // Streaming is not supported by code-gecko
    // TODO: convert to non-streaming fim method when one exist in continue.
    yield (await resp.json()).predictions[0].content;
  }
}




export default VertexAI;
