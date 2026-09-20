import { AtlasCloudConfig } from "../types.js";
import { OpenAIApi } from "./OpenAI.js";

export const ATLASCLOUD_API_BASE = "https://api.atlascloud.ai/v1/";

export class AtlasCloudApi extends OpenAIApi {
  constructor(config: AtlasCloudConfig) {
    super({
      ...config,
      provider: "openai",
      apiBase: config.apiBase ?? ATLASCLOUD_API_BASE,
    });
  }
}
