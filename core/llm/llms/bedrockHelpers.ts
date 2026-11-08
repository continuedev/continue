import { normalizeClaudeModelId } from "../utils/calculateRequestCost.js";
import { resolveCacheParts } from "./anthropicCache.js";
import {
  budgetTokensToEffort,
  supportsAdaptiveThinking,
} from "./anthropicThinking.js";

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
  ctx: {
    profile?: string;
    region?: string;
    usedProfile?: boolean;
    /** The request was signed with a Bedrock API key (bearer token). */
    apiKey?: boolean;
  },
): string | undefined {
  const err = error as { name?: string; message?: string } | undefined;
  const text = `${err?.name ?? ""} ${err?.message ?? ""}`;
  const profileArg = ctx.profile ? ` --profile ${ctx.profile}` : "";

  // A 403 with this text is all Bedrock says when a short-term key is used
  // outside the region it was generated for (seen live 2026-11-08).
  if (ctx.apiKey && /make sure your API Key is valid/i.test(text)) {
    return `Bedrock rejected the API key${
      ctx.region ? ` in ${ctx.region}` : ""
    }. A short-term key only works in the region it was generated for, so \`region\` must match it; a long-term key may have expired or been revoked.`;
  }
  // A retired model: ResourceNotFoundException "This model version has
  // reached the end of its life" (Nova Premier, seen live 2026-11-08) while
  // ListInferenceProfiles and GetFoundationModelAvailability still say yes.
  // Access or a profile would not help, so neither is suggested.
  if (/reached the end of its life/i.test(text)) {
    return "This model has been retired (end of life) and Bedrock no longer serves it, although its inference profile is still listed. Pick a current model: Test connection in the model picker lists the ones this account can use.";
  }
  // A ResourceNotFoundException, not an AccessDenied, so it is matched first.
  if (/marked by provider as Legacy/i.test(text)) {
    return "This model is legacy and Bedrock no longer serves it to accounts that have not used it in the last 30 days. Pick a current model: Test connection in the model picker lists them and marks the ones that need access.";
  }

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
  /**
   * An Anthropic model on an account that has not filled out Anthropic's
   * use-case form. Bedrock still lists it as ACTIVE, but chat is refused.
   */
  needsAnthropicUseCase?: boolean;
  /**
   * What GetFoundationModelAvailability says about this account's access to
   * the model. Absent when it was not asked (Amazon's own models) or the
   * lookup failed.
   */
  access?: BedrockModelAccess;
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
    // This also drops a profile whose base model Bedrock no longer lists: on
    // 2026-11-08 ListInferenceProfiles still returned
    // us.amazon.nova-premier-v1:0 (ACTIVE) while amazon.nova-premier-v1:0 was
    // absent from ListFoundationModels and requests to it failed with "reached
    // the end of its life".
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

/**
 * Whether a GetUseCaseForModelAccess failure means the account has not filled
 * out the form. Bedrock answers 404 with "You have not filled out the request
 * form. Fill out the form before getting access." Any other failure says
 * nothing about the form.
 */
export function isUseCaseFormMissingError(error: unknown): boolean {
  const err = error as { name?: string; message?: string } | undefined;
  return (
    err?.name === "ResourceNotFoundException" &&
    /not filled out the request form/i.test(err?.message ?? "")
  );
}

/** Flag the catalog's Anthropic models as waiting on the use-case form. */
export function markAnthropicUseCaseNeeded(
  catalog: BedrockModelOption[],
): BedrockModelOption[] {
  return catalog.map((option) =>
    option.provider === "Anthropic" ||
    option.baseModelId?.startsWith("anthropic.")
      ? { ...option, needsAnthropicUseCase: true }
      : option,
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

/** Which parts of a Converse request get, or may get, a cache point. */
export interface BedrockCacheParts {
  tools: boolean;
  system: boolean;
  conversation: boolean;
}

/**
 * Amazon Nova models that take explicit cache checkpoints: the Nova rows of the
 * "Supported models" table in the AWS Bedrock prompt caching guide (checked
 * 2026-11-08) are Nova 2 Lite, Nova Pro, Nova Lite and Nova Micro, each with a
 * 1K-token minimum, 4 checkpoints, a 5-minute lifetime only, and checkpoints
 * in `system` and `messages` but not `tools`. Nova Premier and the other Nova
 * 2 models are not in the table and get nothing. `us.amazon.nova-2-lite-v1:0`
 * and `amazon.nova-pro-v1:0` match; `nova-premier` and `nova-2-pro` do not.
 */
const NOVA_CACHE_MODELS = /(^|\.)amazon\.nova-(2-lite|pro|lite|micro)-v\d/i;

/**
 * Which fields of a Converse request accept a `cachePoint` on this model, or
 * undefined for a model that accepts none. Claude takes one in `tools`,
 * `system` and `messages`. Nova takes `system` and `messages` only: checked
 * live on 2026-11-04, a Nova model refused a request whose tool list carried a
 * cache point, which is what `promptCaching: true` used to send it, and the
 * AWS table lists `system` and `messages` for Nova. GPT and Grok on Bedrock
 * cache by themselves and refuse any cache point. A `ttl` is a separate
 * question (`bedrockCacheTtl`): Nova takes only the 5-minute default.
 *
 * There are two copies, this one and the one in
 * packages/openai-adapters/src/apis/bedrockHelpers.ts; see
 * `bedrockSupportsOneHourCache` for why, and bedrockCacheFields.vitest.ts
 * fails if they disagree.
 */
export function bedrockCachePointFields(
  modelId: string,
): BedrockCacheParts | undefined {
  if (/claude/i.test(modelId)) {
    return { tools: true, system: true, conversation: true };
  }
  if (NOVA_CACHE_MODELS.test(modelId)) {
    return { tools: false, system: true, conversation: true };
  }
  return undefined;
}

/**
 * `resolveCacheParts`, limited to the fields this model accepts a cache point
 * in, and nothing at all for a model that accepts none, so `promptCaching:
 * true` on a GPT, Grok or unlisted Nova model sends no `cachePoint` field (the
 * request would be refused).
 */
export function bedrockCachePartsForModel(
  modelId: string,
  requested: boolean | undefined,
  behavior:
    { cacheSystemMessage?: boolean; cacheConversation?: boolean } | undefined,
  hasSystem: boolean,
): BedrockCacheParts {
  const fields = bedrockCachePointFields(modelId);
  if (!fields) return { tools: false, system: false, conversation: false };
  const parts = resolveCacheParts(requested, behavior, hasSystem);
  return {
    tools: parts.tools && fields.tools,
    system: parts.system && fields.system,
    conversation: parts.conversation && fields.conversation,
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

const MISTRAL_TOOL_ID = /^[A-Za-z0-9]{9}$/;

/**
 * Mistral models on Bedrock accept only tool call IDs of exactly nine letters
 * or digits ("Tool call id was ... but must be a-z, A-Z, 0-9, with a length of
 * 9"). Their own IDs already look like that, but a conversation can hold IDs
 * from another model (Claude and Nova use `tooluse_...`) after a model switch.
 */
export function bedrockNeedsNineCharToolIds(modelId: string): boolean {
  return /(^|\.)mistral\./i.test(modelId);
}

/** A stable nine-character letters-and-digits ID for `id`. */
export function nineCharToolId(id: string): string {
  if (MISTRAL_TOOL_ID.test(id)) return id;
  const alphabet =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  // Two FNV-1a passes give ~64 bits, enough for nine base-62 digits.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < id.length; i++) {
    const c = id.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0;
  }
  let n = BigInt(h1) * 0x100000000n + BigInt(h2);
  let out = "";
  for (let i = 0; i < 9; i++) {
    out += alphabet[Number(n % 62n)];
    n /= 62n;
  }
  return out;
}

/**
 * Rewrites toolUse and toolResult IDs in converted Converse messages for
 * models that need nine-character IDs. The same input ID always maps to the
 * same output, so each toolResult still matches its toolUse.
 */
export function normalizeToolUseIds<
  M extends {
    content?: Array<{
      toolUse?: { toolUseId?: string };
      toolResult?: { toolUseId?: string };
    }>;
  },
>(messages: M[], modelId: string): M[] {
  if (!bedrockNeedsNineCharToolIds(modelId)) return messages;
  for (const message of messages) {
    for (const block of message.content ?? []) {
      if (block.toolUse?.toolUseId) {
        block.toolUse.toolUseId = nineCharToolId(block.toolUse.toolUseId);
      }
      if (block.toolResult?.toolUseId) {
        block.toolResult.toolUseId = nineCharToolId(block.toolResult.toolUseId);
      }
    }
  }
  return messages;
}

/**
 * Whether Bedrock refused a request because it does not know the model ID.
 * Happens when `crossRegionInference: auto` put a geographic prefix on a
 * model that is only offered on demand (`qwen.*`, `deepseek.v3.2`, the newer
 * Mistral models): `us.qwen.qwen3-32b-v1:0` answers "The provided model
 * identifier is invalid".
 */
export function isInvalidModelIdentifierError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e ?? "");
  return /provided model identifier is invalid/i.test(message);
}

/**
 * Models whose tool calls must go through Converse rather than
 * ConverseStream (checked live 2026-11-08):
 *
 * - Llama 4 Maverick and Scout refuse every ConverseStream request that
 *   carries tools with "This model doesn't support tool use in streaming
 *   mode."; the same request to Converse returns a proper toolUse block.
 * - Qwen3 32B streams tool input with its opening fragment missing, so the
 *   arguments never parse; Converse returned complete input every time.
 *
 * Requests without tools stream as usual. There are two copies, this one and
 * packages/openai-adapters/src/apis/bedrockHelpers.ts (see
 * `bedrockSupportsOneHourCache` for why).
 */
const NON_STREAMING_TOOL_MODELS: RegExp[] = [
  /(^|\.)meta\.llama4-/i,
  /(^|\.)qwen\.qwen3-32b($|[-:])/i,
];

export function bedrockToolsNeedNonStreaming(modelId: string): boolean {
  return NON_STREAMING_TOOL_MODELS.some((m) => m.test(modelId));
}

/** Bedrock's refusal of tools in ConverseStream, for a retry through Converse. */
export function isStreamingToolUseUnsupportedError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e ?? "");
  return /doesn't support tool use in streaming mode/i.test(message);
}

/**
 * Nova Pro, Lite, Micro and Premier write their reasoning into the text as
 * literal `<thinking>...</thinking>` (Nova Pro, seen live 2026-11-08), so the
 * GUI showed the reasoning as the answer. Nova 2 uses reasoningContent and
 * does not match.
 */
export function writesThinkingTags(modelId: string): boolean {
  return /nova-(pro|lite|micro|premier)/i.test(modelId);
}

const THINKING_OPEN = "<thinking>";
const THINKING_CLOSE = "</thinking>";

/** Text split into what is shown as the answer and what is shown as reasoning. */
export interface ThinkingSplit {
  content: string;
  reasoning: string;
}

/** The longest proper prefix of `tag` that `text` ends with, as a length. */
function trailingTagPrefix(text: string, tag: string): number {
  const max = Math.min(text.length, tag.length - 1);
  for (let n = max; n > 0; n--) {
    if (tag.startsWith(text.slice(-n))) return n;
  }
  return 0;
}

/**
 * Lifts `<thinking>...</thinking>` out of a text stream into reasoning, one
 * block at a time: `push` takes each text delta and returns what can be shown
 * now, holding back a trailing fragment that could still become a tag;
 * `flush` releases what is held when the block ends. Text outside the tags
 * stays content; the newlines right after a closing tag are dropped so the
 * answer does not start with a blank line. Two copies, as above.
 */
export class ThinkingTagSplitter {
  private hold = "";
  private inside = false;
  private skipNewlines = false;

  push(text: string): ThinkingSplit {
    let buffered = this.hold + text;
    this.hold = "";
    const out: ThinkingSplit = { content: "", reasoning: "" };
    for (;;) {
      if (this.skipNewlines) {
        buffered = buffered.replace(/^[\r\n]+/, "");
        if (buffered) this.skipNewlines = false;
      }
      const tag = this.inside ? THINKING_CLOSE : THINKING_OPEN;
      const at = buffered.indexOf(tag);
      if (at !== -1) {
        this.emit(out, buffered.slice(0, at));
        buffered = buffered.slice(at + tag.length);
        this.inside = !this.inside;
        if (!this.inside) this.skipNewlines = true;
        continue;
      }
      const partial = trailingTagPrefix(buffered, tag);
      this.hold = partial ? buffered.slice(-partial) : "";
      this.emit(out, partial ? buffered.slice(0, -partial) : buffered);
      return out;
    }
  }

  /** What is still held when the block ends: a fragment that never became a tag. */
  flush(): ThinkingSplit {
    const out: ThinkingSplit = { content: "", reasoning: "" };
    this.emit(out, this.hold);
    this.hold = "";
    return out;
  }

  private emit(out: ThinkingSplit, text: string): void {
    if (!text) return;
    if (this.inside) out.reasoning += text;
    else out.content += text;
  }
}

/**
 * The model ID to retry with when the prefixed one is refused as invalid: the
 * bare ID, but only when the prefix was guessed from the region by `auto`. An
 * explicit prefix or an ID the user wrote with a prefix is their choice and is
 * not second-guessed.
 */
export function crossRegionFallbackModelId(
  modelId: string,
  setting: string | undefined,
  region: string | undefined,
): string | undefined {
  if (setting !== "auto") return undefined;
  const applied = applyCrossRegionInference(modelId, setting, region);
  return applied === modelId ? undefined : modelId;
}

export type BedrockReasoningEffort = "low" | "medium" | "high";

/** What a Converse request sends to turn a model's reasoning on or off. */
export interface BedrockReasoningRequest {
  /** Spread into `additionalModelRequestFields`; empty when nothing is sent. */
  additionalModelRequestFields: Record<string, unknown>;
  /** Nova 2 refuses `maxTokens` when its reasoning effort is `high`. */
  omitMaxTokens: boolean;
}

const NOVA_2_MODEL = /nova-2-/i;
/** Qwen3 and DeepSeek V3.2 share a backend that takes `reasoning_effort`. */
const REASONING_EFFORT_MODEL = /(^|\.)(qwen\.|deepseek\.v3)/i;

/**
 * The reasoning switch per model family, measured live on 2026-11-08
 * (probe-model-families.md):
 *
 * - Claude: Anthropic's `thinking` (adaptive with `output_config.effort` on
 *   the models that take it, else `budget_tokens`).
 * - Nova 2 (`nova-2-`): `reasoningConfig: { type: "enabled",
 *   maxReasoningEffort }`, and no `maxTokens` at `high`. Nova Pro, Lite,
 *   Micro and Premier refuse any `reasoningConfig`.
 * - Qwen3 and DeepSeek V3.2: `reasoning_effort` low, medium or high turns
 *   reasoning on; `"none"` turns it off, and is sent only when the config
 *   says `reasoning: false`, never by default. `xhigh` is refused.
 * - DeepSeek R1 reasons always and refuses every additional field; Llama
 *   refuses `thinking` as an extraneous key; Mistral ignores it. Nothing is
 *   sent to them.
 *
 * There are two copies, this one and the one in
 * packages/openai-adapters/src/apis/bedrockHelpers.ts (see
 * `bedrockSupportsOneHourCache` for why); bedrockReasoningFields.vitest.ts
 * fails if they disagree.
 */
export function bedrockReasoningFields(
  modelId: string,
  reasoning: boolean | undefined,
  budgetTokens: number,
): BedrockReasoningRequest {
  const none = { additionalModelRequestFields: {}, omitMaxTokens: false };
  if (/claude/i.test(modelId)) {
    if (!reasoning) return none;
    if (supportsAdaptiveThinking(modelId)) {
      return {
        additionalModelRequestFields: {
          thinking: { type: "adaptive" },
          output_config: { effort: budgetTokensToEffort(budgetTokens) },
        },
        omitMaxTokens: false,
      };
    }
    return {
      additionalModelRequestFields: {
        thinking: { type: "enabled", budget_tokens: budgetTokens },
      },
      omitMaxTokens: false,
    };
  }
  if (NOVA_2_MODEL.test(modelId)) {
    if (!reasoning) return none;
    const effort = budgetTokensToEffort(budgetTokens);
    return {
      additionalModelRequestFields: {
        reasoningConfig: { type: "enabled", maxReasoningEffort: effort },
      },
      omitMaxTokens: effort === "high",
    };
  }
  if (REASONING_EFFORT_MODEL.test(modelId)) {
    if (reasoning === undefined) return none;
    return {
      additionalModelRequestFields: {
        reasoning_effort: reasoning
          ? budgetTokensToEffort(budgetTokens)
          : "none",
      },
      omitMaxTokens: false,
    };
  }
  return none;
}

/**
 * The sampling fields a Claude model on Bedrock accepts: `temperature` and
 * `topP` together are refused even without thinking ("cannot both be
 * specified"), so only `temperature` is kept when both are set; with thinking
 * on, `temperature` other than 1 and `topP` below 0.95 are refused, so neither
 * is sent. Other families take both. `topK` is never sent on Bedrock.
 *
 * Two copies, as `bedrockReasoningFields`.
 */
export function bedrockSamplingParams(
  modelId: string,
  temperature: number | undefined,
  topP: number | undefined,
  reasoning: boolean,
): { temperature?: number; topP?: number } {
  if (!/claude/i.test(modelId)) return { temperature, topP };
  if (reasoning) return {};
  if (temperature !== undefined && topP !== undefined) return { temperature };
  return { temperature, topP };
}

/**
 * DeepSeek V3.2 on Bedrock ends the text block before each `toolUse` block
 * with this fragment of its own tool-call markup (fullwidth bars), in Converse
 * and in the stream.
 */
export const DEEPSEEK_DSML_MARKER = "<\uFF5CDSML\uFF5Cfunction_calls";

export function leaksDsmlMarker(modelId: string): boolean {
  return /(^|\.)deepseek\.v3/i.test(modelId);
}

/**
 * Splits text buffered from one content block into what can be shown now and
 * what has to wait: the marker may arrive split across deltas, so a trailing
 * piece that could still become it is held back, and once the marker is seen
 * it and everything after it are held for `flushDsmlHold` to drop at the end
 * of the block.
 */
export function holdBackDsmlMarker(buffered: string): {
  emit: string;
  hold: string;
} {
  const at = buffered.indexOf(DEEPSEEK_DSML_MARKER);
  if (at !== -1) {
    return { emit: buffered.slice(0, at), hold: buffered.slice(at) };
  }
  const max = Math.min(buffered.length, DEEPSEEK_DSML_MARKER.length - 1);
  for (let n = max; n > 0; n--) {
    if (DEEPSEEK_DSML_MARKER.startsWith(buffered.slice(-n))) {
      return { emit: buffered.slice(0, -n), hold: buffered.slice(-n) };
    }
  }
  return { emit: buffered, hold: "" };
}

/** What held-back text to show when its block ends: nothing if it was the marker. */
export function flushDsmlHold(hold: string): string {
  return hold.startsWith(DEEPSEEK_DSML_MARKER) ? "" : hold;
}

/**
 * Whether a conversation cache point may only follow a text block of a user
 * message. Nova refuses a cachePoint next to a toolResult ("extraneous key
 * [cachePoint]", seen live 2026-11-08 at the second request of every
 * multi-turn run), so a user message made of tool results gets none. Claude
 * takes a cache point after a toolResult.
 */
export function bedrockCachePointAfterTextOnly(modelId: string): boolean {
  return !/claude/i.test(modelId);
}

/** Bedrock's `stopReason` as OpenAI's `finish_reason`. */
export function bedrockFinishReason(
  stopReason: string,
): "stop" | "length" | "tool_calls" | "content_filter" {
  switch (stopReason) {
    case "max_tokens":
    case "model_context_window_exceeded":
      return "length";
    case "tool_use":
      return "tool_calls";
    case "content_filtered":
    case "guardrail_intervened":
      return "content_filter";
    default:
      return "stop";
  }
}

// ---------------------------------------------------------------------------
// Model access and inference profile hints (added 2026-11-08)
// ---------------------------------------------------------------------------

/**
 * The account's access to a model, from GetFoundationModelAvailability:
 * "needs-access" when the agreement is NOT_AVAILABLE (or the identity is not
 * authorised, not entitled, or the region does not serve it), "pending" while
 * an agreement request is open, else "available".
 */
export type BedrockModelAccess = "available" | "needs-access" | "pending";

/** Subset of GetFoundationModelAvailabilityResponse we rely on. */
export interface FoundationModelAvailabilityLike {
  agreementAvailability?: { status?: string; errorMessage?: string };
  authorizationStatus?: string;
  entitlementAvailability?: string;
  regionAvailability?: string;
}

export function modelAccessFromAvailability(
  availability: FoundationModelAvailabilityLike,
): BedrockModelAccess {
  const agreement = availability.agreementAvailability?.status;
  if (agreement === "PENDING") return "pending";
  if (
    agreement === "NOT_AVAILABLE" ||
    agreement === "ERROR" ||
    availability.authorizationStatus === "NOT_AUTHORIZED" ||
    availability.entitlementAvailability === "NOT_AVAILABLE" ||
    availability.regionAvailability === "NOT_AVAILABLE"
  ) {
    return "needs-access";
  }
  return "available";
}

/**
 * The base model IDs worth an availability lookup: every third-party model in
 * the catalog. Amazon's own models need no agreement, and application
 * profiles over unknown models have no base to ask about.
 */
export function modelsNeedingAccessCheck(
  catalog: BedrockModelOption[],
): string[] {
  const ids = new Set<string>();
  for (const option of catalog) {
    const baseId = option.baseModelId;
    if (!baseId || option.kind === "application-profile") continue;
    if (option.provider === "Amazon" || baseId.startsWith("amazon.")) continue;
    ids.add(baseId);
  }
  return [...ids];
}

/** Stamp each catalog entry with the access state of its base model. */
export function applyModelAccess(
  catalog: BedrockModelOption[],
  access: ReadonlyMap<string, BedrockModelAccess>,
): BedrockModelOption[] {
  return catalog.map((option) => {
    const state = option.baseModelId
      ? access.get(option.baseModelId)
      : undefined;
    return state ? { ...option, access: state } : option;
  });
}

/** The profile IDs to use in place of a bare model ID. */
export interface InferenceProfileSuggestion {
  /** The geographic profile (`us.`, `eu.`, ...), the one for `region` if listed. */
  regional?: string;
  /** The `global.` profile, when the catalog lists one. */
  global?: string;
}

/**
 * For a bare model ID that the catalog offers only through inference profiles,
 * the profile IDs to use instead. Undefined when the ID already carries a
 * prefix, is an ARN, is offered on demand, or is unknown to the catalog (an
 * unknown ID is reported by Bedrock itself, and a stale catalog must not
 * second-guess it).
 */
export function inferenceProfileSuggestion(
  catalog: Pick<BedrockModelOption, "id" | "kind" | "baseModelId">[],
  modelId: string,
  region: string | undefined,
): InferenceProfileSuggestion | undefined {
  if (modelId.startsWith("arn:")) return undefined;
  if (INFERENCE_PROFILE_PREFIXES.some((p) => modelId.startsWith(`${p}.`))) {
    return undefined;
  }
  if (catalog.some((o) => o.kind === "on-demand" && o.id === modelId)) {
    return undefined;
  }
  const profiles = catalog.filter(
    (o) => o.kind === "inference-profile" && o.baseModelId === modelId,
  );
  if (profiles.length === 0) return undefined;

  const wanted = inferenceProfilePrefixForRegion(region);
  const geographic = profiles.filter((o) => !o.id.startsWith("global."));
  const regional =
    geographic.find((o) => wanted && o.id.startsWith(`${wanted}.`)) ??
    geographic[0];
  const global = profiles.find((o) => o.id.startsWith("global."));
  return { regional: regional?.id, global: global?.id };
}

/** The config warning for a bare ID that needs an inference profile. */
export function inferenceProfileWarning(
  modelId: string,
  region: string | undefined,
  suggestion: InferenceProfileSuggestion,
): string {
  const ids = [suggestion.regional, suggestion.global].filter(
    (id): id is string => !!id,
  );
  const useIds =
    ids.length === 0
      ? ""
      : ` or use the profile ID ${ids.map((id) => `\`${id}\``).join(" or ")}`;
  return (
    `Bedrock model \`${modelId}\` is only offered through an inference profile` +
    `${region ? ` in ${region}` : ""}, so requests with this ID will be refused. ` +
    `Set \`crossRegionInference: auto\` under \`env\`${useIds}.`
  );
}
