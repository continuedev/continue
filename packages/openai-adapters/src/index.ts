import dotenv from "dotenv";
import { AnthropicApi } from "./apis/Anthropic.js";
import { AzureOpenAIApi } from "./apis/AzureOpenAI.js";
import { BaseLlmApi } from "./apis/base.js";
import { CohereApi } from "./apis/Cohere.js";
import { DeepSeekApi } from "./apis/DeepSeek.js";
import { GeminiApi } from "./apis/Gemini.js";
import { JinaApi } from "./apis/Jina.js";
import { OpenAIApi } from "./apis/OpenAI.js";

dotenv.config();

export interface LlmApiConfig {
  provider: string;
  model: string;
  apiKey: string;
  apiBase?: string;
}

export function constructLlmApi(config: LlmApiConfig): BaseLlmApi {
  switch (config.provider) {
    case "openai":
      return new OpenAIApi(config);
    case "mistral":
      return new OpenAIApi({
        ...config,
        apiBase: "https://api.mistral.ai/v1/",
      });
    case "azure":
      return new AzureOpenAIApi(config);
    case "voyage":
      return new OpenAIApi({
        ...config,
        apiBase: "https://api.voyageai.com/v1/",
      });
    case "cohere":
      return new CohereApi(config);
    case "anthropic":
      return new AnthropicApi(config);
    case "gemini":
      return new GeminiApi(config);
    case "jina":
      return new JinaApi(config);
    case "deepinfra":
      return new OpenAIApi({
        ...config,
        apiBase: "https://api.deepinfra.com/v1/openai/",
      });
    case "deepseek":
      return new DeepSeekApi(config);
    case "groq":
      return new OpenAIApi({
        ...config,
        apiBase: "https://api.groq.com/openai/v1/",
      });
    case "nvidia":
      return new OpenAIApi({
        ...config,
        apiBase: "https://integrate.api.nvidia.com/v1/",
      });
    case "fireworks":
      return new OpenAIApi({
        ...config,
        apiBase: "https://api.fireworks.ai/inference/v1",
      });
    case "together":
      return new OpenAIApi({
        ...config,
        apiBase: "https://api.together.xyz/v1/",
      });
    case "sambanova":
      return new OpenAIApi({
        ...config,
        apiBase: "https://api.sambanova.ai/v1/",
      });
    case "nebius":
      return new OpenAIApi({
        ...config,
        apiBase: "https://api.studio.nebius.ai/v1/",
      });
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
