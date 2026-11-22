import { z } from "zod";

import { OpenAIConfigSchema } from "../types.js";

import { AceDataCloudMessagesApi } from "./AceDataCloudMessages.js";
import { BaseLlmApi } from "./base.js";
import { OpenAIApi } from "./OpenAI.js";

const catalogSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().min(1),
      type: z.string(),
      label: z.string().optional(),
      capabilities: z.array(z.string()).optional(),
      endpoints: z
        .array(
          z.object({
            protocol: z.string(),
            path: z.string(),
            base_url: z.string(),
            auth: z.string(),
          }),
        )
        .optional(),
    }),
  ),
});

/** Public typed catalog: includes every chat model, not only recommended models. */
export async function fetchAceDataCloudCatalog() {
  // This endpoint is public. Never send the inference key or custom headers here.
  const response = await fetch(
    "https://platform.acedata.cloud/api/v1/models/",
    { signal: AbortSignal.timeout(15_000), redirect: "error" },
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
 * Keep the Continue chat interface while selecting the published wire protocol.
 * Do not advertise responsesStream: the CLI otherwise selects it by model name.
 */
export function createAceDataCloudApi(
  config: z.infer<typeof OpenAIConfigSchema>,
): BaseLlmApi {
  const api = new OpenAIApi({
    ...config,
    apiBase: config.apiBase ?? "https://api.acedata.cloud/v1/",
    useResponsesApi: false,
  });
  const base = new URL(api.apiBase);
  const official =
    base.origin === "https://api.acedata.cloud" &&
    base.pathname.replace(/\/$/, "") === "/v1";
  const messages = new AceDataCloudMessagesApi(config);
  class ResponsesApi extends OpenAIApi {
    protected override shouldUseResponsesEndpoint() {
      return true;
    }
  }
  const responses = new ResponsesApi({
    ...config,
    apiBase: "https://api.acedata.cloud/v1/",
  });
  let catalog: Awaited<ReturnType<typeof fetchAceDataCloudCatalog>> | undefined;
  let expires = 0;
  let pending: ReturnType<typeof fetchAceDataCloudCatalog> | undefined;
  const loadCatalog = async (refresh = false) => {
    if (!refresh && catalog && expires > Date.now()) {
      return catalog;
    }
    pending ??= fetchAceDataCloudCatalog();
    try {
      catalog = await pending;
      expires = Date.now() + 5 * 60_000;
      return catalog;
    } catch (error) {
      if (!refresh && catalog) {
        return catalog;
      }
      throw error;
    } finally {
      pending = undefined;
    }
  };
  const selectApi = async (modelId: string) => {
    if (!official) {
      return api;
    }
    const model = (await loadCatalog()).find((model) => model.id === modelId);
    for (const [protocol, path, baseUrl, selected] of [
      [
        "chat_completions",
        "/v1/chat/completions",
        "https://api.acedata.cloud/v1",
        api,
      ],
      ["messages", "/v1/messages", "https://api.acedata.cloud", messages],
      ["responses", "/v1/responses", "https://api.acedata.cloud/v1", responses],
    ] as const) {
      if (
        model?.endpoints?.some(
          (endpoint) =>
            endpoint.protocol === protocol &&
            endpoint.path === path &&
            endpoint.base_url === baseUrl &&
            endpoint.auth === "bearer",
        )
      ) {
        return selected;
      }
    }
    throw new Error(
      `Ace Data Cloud has no published chat protocol for ${modelId}. Refresh the model catalog.`,
    );
  };
  return {
    chatCompletionNonStream: async (body, signal) => {
      signal.throwIfAborted();
      return (await selectApi(body.model)).chatCompletionNonStream(
        body,
        signal,
      );
    },
    chatCompletionStream: async function* (body, signal) {
      signal.throwIfAborted();
      yield* (await selectApi(body.model)).chatCompletionStream(body, signal);
    },
    completionNonStream: api.completionNonStream.bind(api),
    completionStream: api.completionStream.bind(api),
    fimStream: api.fimStream.bind(api),
    embed: api.embed.bind(api),
    rerank: api.rerank.bind(api),
    list: async () => {
      const models = await api.list();
      if (!official) {
        // Custom endpoints may publish their own typed catalog.
        return models.filter(
          (model) => !("type" in model) || model.type === "chat",
        );
      }
      const chatIds = new Set(
        (await loadCatalog(true)).map((model) => model.id),
      );
      // Intersect account discovery with the typed catalog. Names cannot identify
      // protocols: gpt-4o-image uses chat, while Nano Banana uses Images.
      return models.filter((model) => chatIds.has(model.id));
    },
  };
}
