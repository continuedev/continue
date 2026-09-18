import { assertGatewayProvider } from "./llms/index.js";
import VercelAIGateway from "./llms/VercelAIGateway.js";

export interface FetchedModel {
  name: string;
  modelId?: string;
  description?: string;
  icon?: string;
  contextLength?: number;
  maxTokens?: number;
  supportsTools?: boolean;
  supportsImages?: boolean;
}

export async function fetchModels(
  provider: string,
  apiKey?: string,
  apiBase?: string,
): Promise<FetchedModel[]> {
  assertGatewayProvider(provider);
  const llm = new VercelAIGateway({ apiKey, apiBase, model: "AUTODETECT" });
  return (await llm.listGatewayModels())
    .filter((model) => !model.type || model.type === "language")
    .map((model) => ({
      name: model.name ?? model.id,
      modelId: model.id,
      contextLength: model.context_window,
      maxTokens: model.max_tokens
        ? Math.min(model.max_tokens, 8192)
        : undefined,
      supportsTools: model.tags?.includes("tool-use"),
      supportsImages: model.tags?.includes("vision"),
    }));
}
