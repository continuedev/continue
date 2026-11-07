import { normalizeClaudeModelId } from "../utils/calculateRequestCost.js";

/**
 * Pure helpers for the Bedrock provider (kept separate from Bedrock.ts so they
 * can be unit tested without the AWS SDK).
 */

/** Geographic prefixes Bedrock uses for cross-region inference profile IDs. */
export const INFERENCE_PROFILE_PREFIXES = [
  "us",
  "us-gov",
  "eu",
  "apac",
  "jp",
  "au",
  "ca",
  "global",
] as const;

export type CrossRegionInference =
  "auto" | "us" | "us-gov" | "eu" | "apac" | "jp" | "au" | "ca" | "global";

/** Map an AWS region (e.g. eu-west-1) to the matching inference profile prefix. */
export function inferenceProfilePrefixForRegion(
  region: string | undefined,
): string | undefined {
  if (!region) return undefined;
  if (region.startsWith("us-gov-")) return "us-gov";
  if (region.startsWith("us-")) return "us";
  if (region.startsWith("eu-")) return "eu";
  if (region.startsWith("ap-")) return "apac";
  return undefined;
}

/**
 * Apply the `crossRegionInference` setting to a model ID, e.g.
 * `anthropic.claude-sonnet-4-20250514-v1:0` -> `us.anthropic.claude-sonnet-4-20250514-v1:0`.
 *
 * IDs that already carry a prefix, and ARNs (inference profile / imported
 * model ARNs), are returned untouched so existing configs keep working.
 */
export function applyCrossRegionInference(
  modelId: string,
  setting: string | undefined,
  region: string | undefined,
): string {
  if (!setting) return modelId;
  if (modelId.startsWith("arn:")) return modelId;
  if (INFERENCE_PROFILE_PREFIXES.some((p) => modelId.startsWith(`${p}.`))) {
    return modelId;
  }
  const prefix =
    setting === "auto" ? inferenceProfilePrefixForRegion(region) : setting;
  if (!prefix) return modelId;
  return `${prefix}.${modelId}`;
}

/**
 * Turn common, cryptic AWS failures into a one-line next step.
 * Returns undefined when we have no useful advice.
 */
export function getBedrockErrorHint(
  error: unknown,
  ctx: { profile?: string; region?: string; usedProfile?: boolean },
): string | undefined {
  const err = error as { name?: string; message?: string } | undefined;
  const text = `${err?.name ?? ""} ${err?.message ?? ""}`;
  const profileArg = ctx.profile ? ` --profile ${ctx.profile}` : "";

  if (
    /sso/i.test(text) &&
    /(expired|invalid|refresh|login|token)/i.test(text)
  ) {
    return `Your AWS SSO session has expired or is missing. Run \`aws sso login${profileArg}\` and try again.`;
  }
  if (
    /ExpiredToken|security token included in the request is expired/i.test(text)
  ) {
    return "Your AWS credentials have expired. Refresh them (for SSO: `aws sso login`) or update the access key / session token in your config.";
  }
  if (
    /CredentialsProviderError|Could not load credentials|Missing credentials/i.test(
      text,
    )
  ) {
    return (
      "No AWS credentials found. Configure one of: `apiKey` (Bedrock API key, or the " +
      "AWS_BEARER_TOKEN_BEDROCK env var), `profile` (a profile from ~/.aws/config, " +
      "including SSO profiles), `accessKeyId` + `secretAccessKey` (+ `sessionToken` " +
      "for temporary credentials), or the standard AWS_* environment variables."
    );
  }
  if (
    /on-demand throughput isn.t supported|inference profile/i.test(text) &&
    /ValidationException|invocation/i.test(text)
  ) {
    return "This model needs an inference profile. Set `crossRegionInference: auto` (or us / eu / apac / global), or use the profile ID such as `us.anthropic.claude-...`.";
  }
  if (
    /AccessDenied|not authorized/i.test(text) &&
    /ListFoundationModels|ListInferenceProfiles/i.test(text)
  ) {
    return "These credentials can't list models (needs bedrock:ListFoundationModels and bedrock:ListInferenceProfiles). You can still type a model ID manually.";
  }
  if (/ENOTFOUND|getaddrinfo|Could not resolve host|EAI_AGAIN/i.test(text)) {
    return `Could not reach Bedrock${
      ctx.region ? ` in ${ctx.region}` : ""
    }. Check the region name, your network/proxy, and any custom endpoint (apiBase).`;
  }
  // An explicit deny is a policy decision (identity policy, permissions
  // boundary or service control policy). Enabling the model in the console
  // does not change it, so don't send the user there.
  if (
    /AccessDenied|not authorized/i.test(text) &&
    /explicit deny/i.test(text)
  ) {
    return `Access to this model is explicitly denied by an IAM or organization policy (identity policy, permissions boundary or service control policy)${
      ctx.region ? ` in ${ctx.region}` : ""
    }. Enabling the model in the Bedrock console will not fix this: ask your AWS administrator to allow it. Restricted models can also need separate approval from the model provider.`;
  }
  if (
    /AccessDeniedException/i.test(text) &&
    /model|bedrock:Invoke/i.test(text)
  ) {
    return `Access denied. Make sure the model is enabled for your account in the Bedrock console${
      ctx.region ? ` (region ${ctx.region})` : ""
    } and that your IAM identity allows bedrock:InvokeModel and bedrock:InvokeModelWithResponseStream. If it is already enabled, a policy may be denying it, or the model may need separate approval from its provider.`;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Model discovery
// ---------------------------------------------------------------------------

/** Subset of the control-plane FoundationModelSummary we rely on. */
export interface FoundationModelSummaryLike {
  modelId?: string;
  modelName?: string;
  providerName?: string;
  inputModalities?: string[];
  outputModalities?: string[];
  responseStreamingSupported?: boolean;
  inferenceTypesSupported?: string[];
  modelLifecycle?: { status?: string };
}

/** Subset of the control-plane InferenceProfileSummary we rely on. */
export interface InferenceProfileSummaryLike {
  inferenceProfileId?: string;
  inferenceProfileName?: string;
  type?: string;
  status?: string;
  models?: { modelArn?: string }[];
}

export type BedrockModelKind =
  "on-demand" | "inference-profile" | "application-profile";

export interface BedrockModelOption {
  /** Value to use as the `model` in config. */
  id: string;
  /** Human readable label, e.g. "Claude Sonnet 4.5 (us. cross-region)". */
  name: string;
  provider: string;
  kind: BedrockModelKind;
  /** Underlying foundation model ID when known. */
  baseModelId?: string;
  legacy?: boolean;
}

function baseModelIdFromArn(arn: string | undefined): string | undefined {
  return arn?.match(/:foundation-model\/(.+)$/)?.[1];
}

/**
 * Combine ListFoundationModels and ListInferenceProfiles results into the list
 * of IDs a user can actually put in `model:`.
 *
 * - Models that support on-demand throughput are offered by their model ID.
 * - Models only reachable through an inference profile are offered by the
 *   profile ID (e.g. `us.anthropic.claude-...`), which is what Bedrock requires.
 * - Only text-generating models that support streaming are included (we use
 *   ConverseStream), so embedding/image/video models don't clutter the list.
 */
export function buildModelCatalog(
  foundationModels: FoundationModelSummaryLike[],
  profiles: InferenceProfileSummaryLike[],
): BedrockModelOption[] {
  const byId = new Map<string, BedrockModelOption>();
  const eligible = new Map<string, FoundationModelSummaryLike>();

  for (const fm of foundationModels) {
    if (!fm.modelId) continue;
    if (!(fm.outputModalities ?? []).includes("TEXT")) continue;
    if (fm.responseStreamingSupported === false) continue;
    eligible.set(fm.modelId, fm);
    if ((fm.inferenceTypesSupported ?? []).includes("ON_DEMAND")) {
      byId.set(fm.modelId, {
        id: fm.modelId,
        name: fm.modelName ?? fm.modelId,
        provider: fm.providerName ?? "Other",
        kind: "on-demand",
        baseModelId: fm.modelId,
        legacy: fm.modelLifecycle?.status === "LEGACY",
      });
    }
  }

  for (const p of profiles) {
    const id = p.inferenceProfileId;
    if (!id || (p.status && p.status !== "ACTIVE")) continue;
    const baseId = baseModelIdFromArn(p.models?.[0]?.modelArn);
    const fm = baseId ? eligible.get(baseId) : undefined;
    const isApplication = p.type === "APPLICATION";

    // System profiles must point at an eligible text model; application
    // profiles are the user's own, so keep them even if we can't classify them.
    if (!isApplication && !fm) continue;

    const geography = id.split(".")[0];
    byId.set(id, {
      id,
      name: isApplication
        ? `${p.inferenceProfileName ?? id} (application profile)`
        : `${fm!.modelName ?? id} (${geography}. cross-region)`,
      provider: fm?.providerName ?? "Application profiles",
      kind: isApplication ? "application-profile" : "inference-profile",
      baseModelId: baseId,
      legacy: fm?.modelLifecycle?.status === "LEGACY",
    });
  }

  return [...byId.values()].sort(
    (a, b) =>
      a.provider.localeCompare(b.provider) ||
      Number(!!a.legacy) - Number(!!b.legacy) ||
      a.name.localeCompare(b.name),
  );
}

/** The fields of Bedrock's `TokenUsage` that the provider reads. */
export interface BedrockTokenUsageLike {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadInputTokens?: number;
  cacheWriteInputTokens?: number;
  cacheDetails?: { ttl?: string; inputTokens?: number }[];
}

/**
 * Map Bedrock's usage to Continue's `Usage`. With caching on, Bedrock's
 * `inputTokens` counts only tokens that were neither read from nor written to
 * the cache, which is the same meaning as Anthropic's `input_tokens`, so
 * `promptTokens` keeps that meaning on both paths.
 */
export function bedrockUsageToUsage(usage: BedrockTokenUsageLike): {
  promptTokens: number;
  completionTokens: number;
  promptTokensDetails: {
    cachedTokens: number;
    cacheWriteTokens: number;
    cacheWriteTokens5m?: number;
    cacheWriteTokens1h?: number;
  };
} {
  const details: {
    cachedTokens: number;
    cacheWriteTokens: number;
    cacheWriteTokens5m?: number;
    cacheWriteTokens1h?: number;
  } = {
    cachedTokens: usage.cacheReadInputTokens ?? 0,
    cacheWriteTokens: usage.cacheWriteInputTokens ?? 0,
  };
  // `cacheDetails` is empty when nothing was written.
  if (usage.cacheDetails?.length) {
    details.cacheWriteTokens5m = 0;
    details.cacheWriteTokens1h = 0;
    for (const d of usage.cacheDetails) {
      if (d.ttl === "1h") details.cacheWriteTokens1h += d.inputTokens ?? 0;
      else if (d.ttl === "5m") details.cacheWriteTokens5m += d.inputTokens ?? 0;
    }
  }
  return {
    promptTokens: usage.inputTokens ?? 0,
    completionTokens: usage.outputTokens ?? 0,
    promptTokensDetails: details,
  };
}

/**
 * Claude models on Bedrock that accept a 1-hour cache lifetime (`ttl: "1h"` on a
 * cache point): every Claude row of the "Supported models" table in the AWS
 * Bedrock prompt caching guide lists "5 minutes, 1 hour" (checked 2026-11-04):
 * Haiku 4.5 and 5.5, Sonnet 4.6, 5 and 5.5, Opus 4.5 to 4.8, 5 and 5.5, Fable
 * and Mythos. Sending `ttl` to a model that only supports 5 minutes "can result
 * in a ValidationException", so a model that table does not list gets the
 * default. That leaves out Sonnet 4.5 (not in the table), Sonnet 4, Opus 4 and
 * 4.1, and Claude 3.x. Confirmed live with a 1-hour write and `cacheDetails`
 * on Haiku 4.5, Haiku 5.5, Sonnet 5.5 and Opus 5.5; the others follow the table.
 */
const ONE_HOUR_CACHE_MODELS =
  /^claude-(haiku-4-5|haiku-5|sonnet-4-6|sonnet-5|opus-4-5|opus-4-6|opus-4-7|opus-4-8|opus-5|fable|mythos)/;

export function bedrockSupportsOneHourCache(modelId: string): boolean {
  const id = normalizeClaudeModelId(modelId);
  return !!id && ONE_HOUR_CACHE_MODELS.test(id);
}

/** The `ttl` to put on a cache point, or undefined for the default. */
export function bedrockCacheTtl(
  modelId: string,
  requested: "5m" | "1h" | undefined,
): "1h" | undefined {
  return requested === "1h" && bedrockSupportsOneHourCache(modelId)
    ? "1h"
    : undefined;
}

/**
 * Claude models that take a 1-hour lifetime through Anthropic's own request
 * shape, which Vertex AI and OpenRouter use: Anthropic's prompt caching page
 * says 1 hour works on every model that supports caching. This list is wider
 * than Bedrock's (Sonnet 4.5 is here and not in AWS's table) and still leaves
 * out Claude 3.x and the original Claude 4 releases, which main's earlier list
 * also left out because they were not seen in a table.
 */
const ANTHROPIC_STYLE_ONE_HOUR_MODELS =
  /^claude-(haiku-4-5|haiku-5|sonnet-4-5|sonnet-4-6|sonnet-5|opus-4-5|opus-4-6|opus-4-7|opus-4-8|opus-5|fable|mythos)/;

export function anthropicStyleSupportsOneHourCache(modelId: string): boolean {
  const id = normalizeClaudeModelId(modelId);
  return !!id && ANTHROPIC_STYLE_ONE_HOUR_MODELS.test(id);
}

/** The `ttl` for Vertex AI and OpenRouter, or undefined for the default. */
export function anthropicStyleCacheTtl(
  modelId: string,
  requested: "5m" | "1h" | undefined,
): "1h" | undefined {
  return requested === "1h" && anthropicStyleSupportsOneHourCache(modelId)
    ? "1h"
    : undefined;
}

/** What an account's own model list says about a model's `global.` profile. */
export type GlobalProfileStatus = "present" | "absent" | "unknown";

/**
 * Whether the catalog lists the `global.` inference profile of a model given by
 * a regional ID (`us.anthropic.claude-sonnet-4-6` ->
 * `global.anthropic.claude-sonnet-4-6`). Only a regional ID has a global
 * counterpart worth asking about: a `global.` ID is already it, and a bare ID,
 * an ARN or an application profile has none to suggest, so those are "unknown"
 * (nothing was checked) rather than "absent".
 */
export function globalProfileStatus(
  catalog: Pick<BedrockModelOption, "id" | "kind">[],
  modelId: string,
): GlobalProfileStatus {
  const m = modelId.match(/^(us|eu|apac|jp|au|ca)\.(.+)$/i);
  if (!m) return "unknown";
  const wanted = `global.${m[2]}`.toLowerCase();
  return catalog.some(
    (o) => o.kind === "inference-profile" && o.id.toLowerCase() === wanted,
  )
    ? "present"
    : "absent";
}

/**
 * Whether Bedrock refused a request because the model doesn't accept
 * `stopSequences`. Qwen, the newer Mistral models and gpt-oss on Bedrock all
 * answer "This model doesn't support the stopSequences field".
 */
export function isStopSequencesUnsupportedError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e ?? "");
  return /doesn't support the stopSequences field/i.test(message);
}
