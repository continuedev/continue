import type { BedrockModelOptionInfo } from "core/protocol/core";
import type { ModelPackage } from "../pages/AddNewModel/configs/models";

/** How many live models are promoted to the top ("Popular") section. */
export const POPULAR_MODEL_COUNT = 6;

// Ids returned by provider list endpoints that are not chat/coding models.
const NON_CHAT_MODEL_ID =
  /embed|whisper|tts|dall-e|moderation|realtime|audio|transcribe|image|davinci|babbage|rerank/i;

export function isLikelyChatModelId(id: string): boolean {
  return !NON_CHAT_MODEL_ID.test(id);
}

const BEDROCK_GEO_PREFIX = /^(us-gov|us|eu|apac|jp|au|ca|global)\./;

/** `us.anthropic.claude-x` and `anthropic.claude-x` are the same model. */
function normalizeModelId(id: string): string {
  return id.replace(BEDROCK_GEO_PREFIX, "");
}

function createdAtMs(pkg: ModelPackage): number {
  const t = pkg.createdAt ? Date.parse(pkg.createdAt) : NaN;
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Turn the models Bedrock reports for the entered credentials/region into
 * selectable packages. When a model is reachable both on demand and through a
 * cross-region profile only one entry is kept (on demand wins), because the
 * `crossRegionInference` setting adds the profile prefix at request time.
 */
export function bedrockOptionsToPackages(
  options: BedrockModelOptionInfo[],
  provider: "bedrock" | "bedrock-mantle" = "bedrock",
): ModelPackage[] {
  const onDemandBases = new Set(
    options
      .filter((o) => o.kind === "on-demand")
      .map((o) => normalizeModelId(o.baseModelId ?? o.id)),
  );

  return options
    .filter(
      (o) =>
        o.kind !== "inference-profile" ||
        !onDemandBases.has(normalizeModelId(o.baseModelId ?? o.id)),
    )
    .map((o) => ({
      title: o.name,
      description: `${o.provider} · ${o.id}`,
      params: {
        model: o.id,
        title: `${o.name} (${provider === "bedrock-mantle" ? "Bedrock Mantle" : "Bedrock"})`,
      },
      providerOptions: [provider],
      icon: o.provider === "Anthropic" ? "anthropic.png" : undefined,
      isOpenSource: false,
      deprecated: o.legacy ? true : undefined,
    }));
}

/**
 * Overlay live models on the curated list: where a live model matches a
 * curated package, keep the curated package (better description, context
 * length and token limits) and take the release date / lifecycle from the
 * live entry. Curated models the provider does not offer are dropped.
 */
export function mergeLiveModels(
  curated: ModelPackage[],
  live: ModelPackage[],
): ModelPackage[] {
  const byId = new Map(
    curated.map((p) => [normalizeModelId(p.params.model), p] as const),
  );
  return live.map((l) => {
    const match = byId.get(normalizeModelId(l.params.model));
    return match
      ? {
          ...match,
          createdAt: l.createdAt ?? match.createdAt,
          deprecated: l.deprecated,
        }
      : l;
  });
}

/**
 * Split models into a short "popular" list and the rest. Newest first (when the
 * provider reports dates), then the curated order, then alphabetical.
 * Deprecated models are never promoted.
 */
export function splitPopular(
  models: ModelPackage[],
  curated: ModelPackage[],
  count: number = POPULAR_MODEL_COUNT,
): { top: ModelPackage[]; other: ModelPackage[] } {
  const order = new Map(
    curated.map((p, i) => [normalizeModelId(p.params.model), i] as const),
  );
  const rank = (p: ModelPackage) =>
    order.get(normalizeModelId(p.params.model)) ?? Number.MAX_SAFE_INTEGER;

  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const unique = models.filter((p) => {
    const id = normalizeModelId(p.params.model);
    if (seenIds.has(id) || seenTitles.has(p.title)) return false;
    seenIds.add(id);
    seenTitles.add(p.title);
    return true;
  });

  const sorted = (list: ModelPackage[]) =>
    [...list].sort(
      (a, b) =>
        createdAtMs(b) - createdAtMs(a) ||
        rank(a) - rank(b) ||
        a.title.localeCompare(b.title),
    );

  const active = sorted(unique.filter((p) => !p.deprecated));
  const deprecated = sorted(unique.filter((p) => p.deprecated));
  return {
    top: active.slice(0, count),
    other: [...active.slice(count), ...deprecated],
  };
}

export interface ModelLists {
  top: ModelPackage[];
  other?: ModelPackage[];
  /** True when the lists come from the provider's live model list. */
  isLive: boolean;
}

/**
 * The lists shown in the Model picker. Without a live list this is the curated
 * data; once a connection test or refresh succeeds, it is the live list.
 */
export function computeModelLists(
  provider: { packages: ModelPackage[]; popularPackages?: ModelPackage[] },
  live: ModelPackage[],
): ModelLists {
  if (live.length === 0) {
    const popularTitles = new Set(
      provider.popularPackages?.map((p) => p.title),
    );
    return {
      top: provider.popularPackages ?? provider.packages,
      other: provider.popularPackages
        ? provider.packages.filter((p) => !popularTitles.has(p.title))
        : undefined,
      isLive: false,
    };
  }
  const { top, other } = splitPopular(
    mergeLiveModels(provider.packages, live),
    provider.packages,
  );
  return { top, other, isLive: true };
}
