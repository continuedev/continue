import { ModelDescription } from "@continuedev/config-types/src/index.js";
import dotenv from "dotenv";
import { AzureOpenAIApi } from "./apis/AzureOpenAI.js";
import { OpenAIApi } from "./apis/OpenAI.js";
import { BaseLlmApi } from "./apis/base.js";

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

export {
  type ChatCompletion,
  type ChatCompletionChunk,
  type ChatCompletionCreateParams,
  type ChatCompletionCreateParamsNonStreaming,
  type ChatCompletionCreateParamsStreaming,
  type Completion,
  type CompletionCreateParams,
  type CompletionCreateParamsNonStreaming,
  type CompletionCreateParamsStreaming,
} from "openai/resources/index.mjs";
