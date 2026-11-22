import { z } from "zod";
import { OpenAIConfigSchema } from "../types.js";
import { OpenAIApi } from "./OpenAI.js";
import { BaseLlmApi } from "./base.js";

const catalogSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().min(1),
      type: z.string(),
      label: z.string().optional(),
      capabilities: z.array(z.string()).optional(),
    }),
  ),
});

/** Public typed catalog: includes every chat model, not only recommended models. */
export async function fetchAceDataCloudCatalog() {
  // This endpoint is public. Never send the inference key or custom headers here.
  const response = await fetch(
    "https://platform.acedata.cloud/api/v1/models/",
    { signal: AbortSignal.timeout(15_000) },
  );
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Ace Data Cloud catalog: ${response.status}`,
    );
  }
  const { data } = catalogSchema.parse(await response.json());
  return data.filter((model) => model.type === "chat");
}

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
    list: async () => {
      const models = await api.list();
      if (
        config.apiBase &&
        new URL(config.apiBase).origin !== "https://api.acedata.cloud"
      ) {
        // Custom endpoints may publish their own typed catalog.
        return models.filter(
          (model) => !("type" in model) || model.type === "chat",
        );
      }
      const chatIds = new Set(
        (await fetchAceDataCloudCatalog()).map((model) => model.id),
      );
      // Intersect account discovery with the typed catalog. Names cannot identify
      // protocols: gpt-4o-image uses chat, while Nano Banana uses Images.
      return models.filter((model) => chatIds.has(model.id));
    },
  };
}
