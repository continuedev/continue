import { OpenAIApi } from "./OpenAI.js";
import { OpenAIConfig } from "../types.js";

export interface ClawRouterConfig extends OpenAIConfig {}

/**
 * ClawRouter API adapter
 *
 * ClawRouter is an open-source LLM router that automatically selects the
 * cheapest capable model for each request based on prompt complexity.
 * It provides an OpenAI-compatible API at localhost:1337.
 *
 * @see https://github.com/BlockRunAI/ClawRouter
 */
export class ClawRouterApi extends OpenAIApi {
  constructor(config: ClawRouterConfig) {
    super({
      ...config,
      apiBase: config.apiBase ?? "http://localhost:1337/v1/",
    });
  }
}

export default ClawRouterApi;
