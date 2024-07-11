import { ModelDescription } from "@continuedev/config-types/src/index.js";
import dotenv from "dotenv";
import { AzureOpenAIApi } from "./AzureOpenAI.js";
import { OpenAIApi } from "./OpenAI.js";
import { BaseLlmApi } from "./base.js";

dotenv.config();

export function constructLlmApi(config: ModelDescription): BaseLlmApi {
  switch (config.provider) {
    case "openai":
      return new OpenAIApi(config);
    case "azure":
      return new AzureOpenAIApi(config);
    default:
      throw new Error(`Unsupported LLM API format: ${config.provider}`);
  }
}
