import { z } from "zod";

import { OpenAIConfigSchema } from "../types.js";
import { BaseLlmApi } from "./base.js";
import { OpenAIApi } from "./OpenAI.js";

const officialBase = "https://api.acedata.cloud/v1";
const catalogSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().min(1),
      type: z.string(),
      endpoints: z.array(z.object({ protocol: z.string() })).optional(),
    }),
  ),
});

async function listChatIds(): Promise<Set<string>> {
  const response = await fetch(
    "https://platform.acedata.cloud/api/v1/models/?type=chat",
    {
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    },
  );
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Ace Data Cloud catalog: ${response.status}`,
    );
  }
  const { data } = catalogSchema.parse(await response.json());
  return new Set(
    data
      .filter(
        (model) =>
          model.type === "chat" &&
          model.endpoints?.some(
            (endpoint) => endpoint.protocol === "chat_completions",
          ),
      )
      .map((model) => model.id),
  );
}

export function createAceDataCloudApi(
  config: z.infer<typeof OpenAIConfigSchema>,
): BaseLlmApi {
  const api = new OpenAIApi({
    ...config,
    apiBase: config.apiBase ?? officialBase + "/",
    useResponsesApi: false,
  });
  // The CLI uses the presence of responsesStream to choose its wire protocol.
  return {
    chatCompletionNonStream: api.chatCompletionNonStream.bind(api),
    chatCompletionStream: api.chatCompletionStream.bind(api),
    completionNonStream: api.completionNonStream.bind(api),
    completionStream: api.completionStream.bind(api),
    fimStream: api.fimStream.bind(api),
    embed: api.embed.bind(api),
    rerank: api.rerank.bind(api),
    list: async () => {
      const models = await api.list();
      if (api.apiBase.replace(/\/$/, "") !== officialBase) {
        return models.filter(
          (model) => !("type" in model) || model.type === "chat",
        );
      }
      const compatible = await listChatIds();
      return models.filter((model) => compatible.has(model.id));
    },
  };
}
