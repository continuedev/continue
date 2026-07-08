import { ChatCompletionCreateParams } from "openai/resources/index";
import { MiniMaxConfig } from "../types.js";
import { OpenAIApi } from "./OpenAI.js";

export const MINIMAX_API_BASE = "https://api.minimax.io/v1/";

export class MiniMaxApi extends OpenAIApi {
  constructor(config: MiniMaxConfig) {
    super({
      ...config,
      provider: "openai",
      apiBase: config.apiBase ?? MINIMAX_API_BASE,
    });
  }

  modifyChatBody<T extends ChatCompletionCreateParams>(body: T): T {
    body = super.modifyChatBody(body);

    // MiniMax requires temperature in (0.0, 1.0] — zero is rejected
    if (body.temperature !== undefined && body.temperature !== null) {
      if (body.temperature <= 0) {
        body.temperature = 0.01;
      } else if (body.temperature > 1) {
        body.temperature = 1.0;
      }
    }

    // MiniMax does not support response_format
    if ((body as any).response_format) {
      delete (body as any).response_format;
    }

    return body;
  }
}
