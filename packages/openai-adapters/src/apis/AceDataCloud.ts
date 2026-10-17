import { z } from "zod";
import { OpenAIConfigSchema } from "../types.js";
import { OpenAIApi } from "./OpenAI.js";
import { BaseLlmApi } from "./base.js";

/**
 * Expose the Chat Completions contract only. In particular, do not advertise
 * responsesStream: the CLI otherwise selects it from the model name alone.
 */
export function createAceDataCloudApi(
  config: z.infer<typeof OpenAIConfigSchema>,
): BaseLlmApi {
  const api = new OpenAIApi({
    ...config,
    apiBase: config.apiBase ?? "https://api.acedata.cloud/v1/",
    useResponsesApi: false,
  });
  return {
    chatCompletionNonStream: api.chatCompletionNonStream.bind(api),
    chatCompletionStream: api.chatCompletionStream.bind(api),
    completionNonStream: api.completionNonStream.bind(api),
    completionStream: api.completionStream.bind(api),
    fimStream: api.fimStream.bind(api),
    embed: api.embed.bind(api),
    rerank: api.rerank.bind(api),
    list: api.list.bind(api),
  };
}
