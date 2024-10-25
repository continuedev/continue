import { GoogleAuth } from "google-auth-library";
import { LLMOptions } from "../../index.js";
import { BaseLLM } from "../index.js";

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
}

export default VertexAI;
