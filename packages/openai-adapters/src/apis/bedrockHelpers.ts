/**
 * Pure helpers for the Bedrock adapter. Keep in sync with
 * core/llm/llms/bedrockHelpers.ts (core cannot import this package's sources).
 */
import type { CacheTtl } from "./cacheTtl.js";

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
    /AccessDeniedException/i.test(text) &&
    /model|bedrock:Invoke/i.test(text)
  ) {
    return `Access denied. Make sure the model is enabled for your account in the Bedrock console${
      ctx.region ? ` (region ${ctx.region})` : ""
    } and that your IAM identity allows bedrock:InvokeModel and bedrock:InvokeModelWithResponseStream.`;
  }
  return undefined;
}

/**
 * The message to show when Bedrock refuses a call because the AWS account has
 * not been granted the model, or undefined for any other error. AWS uses this
 * refusal for an unfinished console step and for a tokens-per-minute quota of
 * 0, which is how a newer model can look available and still be refused. The
 * error alone can't say which, so this lists what to check (seen live: form and
 * agreement done, quota 0).
 *
 * Core's Bedrock provider uses this too. The lines are joined by single
 * newlines because the chat window shows only what follows the first blank
 * line of an error (parseErrorMessage in gui/src/util/errorAnalysis.ts).
 */
export function bedrockModelAccessMessage(
  error: unknown,
  modelId: string,
): string | undefined {
  const err = error as { name?: string; message?: string } | undefined;
  const message = err?.message ?? "";
  if (
    !/AccessDeniedException/i.test(`${err?.name ?? ""} ${message}`) ||
    !/not available for this account/i.test(message)
  ) {
    return undefined;
  }
  return [
    `Amazon Bedrock refused ${modelId}: this AWS account has not been given access to that model.`,
    "Check the model's tokens-per-minute quota in Service Quotas: AWS can leave it at 0 for newer models until it grants the account access, and only AWS can raise it. For Anthropic models, also check that the use-case form and the model agreement are complete in the Bedrock console (https://console.aws.amazon.com/bedrock/).",
    `AWS said: ${message}`,
  ].join("\n");
}

/** The fields of Bedrock's `TokenUsage` that the adapter reads. */
export interface BedrockTokenUsageLike {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadInputTokens?: number;
  cacheWriteInputTokens?: number;
  /** Writes split by lifetime; empty when nothing was written. */
  cacheDetails?: BedrockCacheDetailLike[];
}

/**
 * Map the usage in a Converse stream's `metadata` event to the OpenAI usage
 * shape, with the cache fields named as the Anthropic adapter names them.
 * With caching on, Bedrock's `inputTokens` counts only tokens that were
 * neither read from nor written to the cache, the same meaning as Anthropic's
 * `input_tokens`, so `prompt_tokens` keeps that meaning on both adapters.
 */
export function bedrockUsageToCompletionUsage(usage: BedrockTokenUsageLike): {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details: {
    cached_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
    cache_write_tokens_5m?: number;
    cache_write_tokens_1h?: number;
  };
} {
  const read = usage.cacheReadInputTokens ?? 0;
  const write = usage.cacheWriteInputTokens ?? 0;
  const split = splitCacheWrites(usage.cacheDetails);
  const prompt = usage.inputTokens ?? 0;
  const completion = usage.outputTokens ?? 0;
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: prompt + completion,
    prompt_tokens_details: {
      cached_tokens: read,
      cache_read_tokens: read,
      cache_write_tokens: write,
      // Only when Bedrock split the writes by lifetime, as the Anthropic
      // adapter does, so a 1-hour write is priced at the 1-hour rate.
      ...(split && {
        cache_write_tokens_5m: split.write5m,
        cache_write_tokens_1h: split.write1h,
      }),
    },
  };
}

/** Which parts of a request get a cache point. */
export interface BedrockCacheParts {
  tools: boolean;
  system: boolean;
  conversation: boolean;
}

/**
 * Decide which parts of a request get cache points. Keep in sync with
 * `resolveCacheParts` in core/llm/llms/anthropicCache.ts.
 *
 * An explicit `promptCaching: false` turns everything off, even when
 * `cacheBehavior` says otherwise. `true` caches the tools, the system prompt
 * and the conversation (up to four cache points: tools, system and the last
 * two user messages). When it is unset, only `cacheBehavior` applies, and with
 * nothing set no cache points are sent.
 */
export function resolveBedrockCacheParts(
  requested: boolean | undefined,
  behavior:
    { cacheSystemMessage?: boolean; cacheConversation?: boolean } | undefined,
  hasSystem: boolean,
): BedrockCacheParts {
  if (requested === false) {
    return { tools: false, system: false, conversation: false };
  }
  if (requested === true) {
    return { tools: true, system: hasSystem, conversation: true };
  }
  return {
    tools: false,
    system: !!(behavior?.cacheSystemMessage && hasSystem),
    conversation: !!behavior?.cacheConversation,
  };
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
 * There are two copies, this one and core/llm/llms/bedrockHelpers.ts; see
 * `bedrockSupportsOneHourCache` for why, and
 * core/llm/llms/bedrockCacheFields.vitest.ts fails if they disagree.
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
 * `resolveBedrockCacheParts`, limited to the fields this model accepts a
 * cache point in, and nothing at all for a model that accepts none, so
 * `promptCaching: true` on a GPT, Grok or unlisted Nova model sends no
 * `cachePoint` field (the request would be refused).
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
  const parts = resolveBedrockCacheParts(requested, behavior, hasSystem);
  return {
    tools: parts.tools && fields.tools,
    system: parts.system && fields.system,
    conversation: parts.conversation && fields.conversation,
  };
}

/** `us.anthropic.claude-sonnet-4-6-v1:0` -> `claude-sonnet-4-6`; undefined if not Claude. */
function claudeKey(modelId: string): string | undefined {
  let id = modelId.toLowerCase();
  const at = id.indexOf("claude");
  if (at === -1) return undefined;
  id = id.slice(at);
  id = id.replace(/@.*$/, "").replace(/-v\d+(:\d+)?$/, "");
  return id.replace(/(\d)\.(\d)/g, "$1-$2");
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
 *
 * There are two copies, this one and core/llm/llms/bedrockHelpers.ts: core's
 * is imported by the chat window, which cannot take this Node-only package.
 * core/llm/llms/bedrockOneHourCache.vitest.ts fails if they disagree.
 */
const ONE_HOUR_CACHE_MODELS =
  /^claude-(haiku-4-5|haiku-5|sonnet-4-6|sonnet-5|opus-4-5|opus-4-6|opus-4-7|opus-4-8|opus-5|fable|mythos)/;

export function bedrockSupportsOneHourCache(modelId: string): boolean {
  const id = claudeKey(modelId);
  return !!id && ONE_HOUR_CACHE_MODELS.test(id);
}

/** The `ttl` to put on a Bedrock cache point, or undefined for the default. */
export function bedrockCacheTtl(
  modelId: string,
  requested: CacheTtl | undefined,
): "1h" | undefined {
  return requested === "1h" && bedrockSupportsOneHourCache(modelId)
    ? "1h"
    : undefined;
}

/** A Bedrock cache point; `ttl` only when it is not the default. */
export function bedrockCachePoint(ttl: "1h" | undefined): {
  cachePoint: { type: "default"; ttl?: "1h" };
} {
  return { cachePoint: { type: "default", ...(ttl && { ttl }) } };
}

/** Per-lifetime cache writes Bedrock reports in `usage.cacheDetails`. */
export interface BedrockCacheDetailLike {
  ttl?: string;
  inputTokens?: number;
}

/** Sum `cacheDetails` into 5-minute and 1-hour writes; undefined when absent. */
export function splitCacheWrites(
  details: BedrockCacheDetailLike[] | undefined,
): { write5m: number; write1h: number } | undefined {
  if (!details?.length) return undefined;
  let write5m = 0;
  let write1h = 0;
  for (const d of details) {
    if (d.ttl === "1h") write1h += d.inputTokens ?? 0;
    else if (d.ttl === "5m") write5m += d.inputTokens ?? 0;
  }
  return { write5m, write1h };
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
 * Gives every toolUse a toolResult in the message right after it, with `text`
 * as the result of any that has none. Claude refuses a conversation with an
 * unanswered tool call ("tool_use ids were found without tool_result blocks
 * immediately after"), and the rest of the history can't be sent without it.
 */
export function fillMissingToolResults<
  M extends {
    role?: string;
    content?: Array<{
      toolUse?: { toolUseId?: string };
      toolResult?: unknown;
      text?: unknown;
    }>;
  },
>(messages: M[], text: string): M[] {
  const filled: M[] = [];
  messages.forEach((message, index) => {
    filled.push(message);
    if (message.role !== "assistant") return;
    const next = messages[index + 1];
    const answered = new Set(
      next?.role === "user"
        ? (next.content ?? []).map(
            (block) =>
              (block.toolResult as { toolUseId?: string } | undefined)
                ?.toolUseId,
          )
        : [],
    );
    const results = (message.content ?? [])
      .map((block) => block.toolUse?.toolUseId)
      .filter((id) => id !== undefined && !answered.has(id))
      .map((toolUseId) => ({
        toolResult: { toolUseId, content: [{ text }] },
      }));
    if (results.length === 0) return;
    if (next?.role === "user") {
      next.content = [...results, ...(next.content ?? [])];
    } else {
      filled.push({ role: "user", content: results } as M);
    }
  });
  return filled;
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

/**
 * Inverse of the GUI mapping (low: 1024, medium: 4096, high: 16384). Same as
 * `budgetTokensToEffort` in core/llm/llms/anthropicThinking.ts.
 */
export function budgetTokensToEffort(
  budgetTokens: number,
): BedrockReasoningEffort {
  if (budgetTokens <= 1024) return "low";
  if (budgetTokens <= 4096) return "medium";
  return "high";
}

/** The budget tokens the GUI uses for an effort (gui/src/util/modeModels.ts). */
export function effortToBudgetTokens(effort: BedrockReasoningEffort): number {
  return effort === "low" ? 1024 : effort === "medium" ? 4096 : 16384;
}

/**
 * Claude models that refuse `thinking.type: "enabled"` and take `adaptive`
 * with `output_config.effort`. Same as `supportsAdaptiveThinking` in
 * core/llm/llms/anthropicThinking.ts.
 */
const ADAPTIVE_THINKING_MODEL =
  /claude-(opus|sonnet|haiku|fable|mythos)-(4-[6-9]|[5-9])/;

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
 * The reasoning switch per model family, measured live on 2026-11-08: Claude
 * takes Anthropic's `thinking`; Nova 2 takes `reasoningConfig` with a
 * `maxReasoningEffort` and no `maxTokens` at `high`; Qwen3 and DeepSeek V3.2
 * take `reasoning_effort` (low, medium, high to turn on, `"none"` to turn off,
 * sent only when reasoning is explicitly off); DeepSeek R1, the other Nova
 * models, Llama and Mistral get nothing. The two copies (this one and
 * core/llm/llms/bedrockHelpers.ts) are compared by
 * core/llm/llms/bedrockReasoningFields.vitest.ts.
 */
export function bedrockReasoningFields(
  modelId: string,
  reasoning: boolean | undefined,
  budgetTokens: number,
): BedrockReasoningRequest {
  const none = { additionalModelRequestFields: {}, omitMaxTokens: false };
  if (/claude/i.test(modelId)) {
    if (!reasoning) return none;
    if (ADAPTIVE_THINKING_MODEL.test(modelId)) {
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
 * `topP` together are refused even without thinking, so only `temperature` is
 * kept when both are set; with thinking on neither is sent. Other families
 * take both. Two copies, as `bedrockReasoningFields`.
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
 * with this fragment of its own tool-call markup (fullwidth bars).
 */
export const DEEPSEEK_DSML_MARKER = "<\uFF5CDSML\uFF5Cfunction_calls";

export function leaksDsmlMarker(modelId: string): boolean {
  return /(^|\.)deepseek\.v3/i.test(modelId);
}

/**
 * Splits text buffered from one content block into what can be shown now and
 * what has to wait: a trailing piece that could still become the marker, or
 * the marker and everything after it, which `flushDsmlHold` drops at the end
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
 * core/llm/llms/bedrockHelpers.ts (see `bedrockSupportsOneHourCache` for why).
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
 * answer does not start with a blank line.
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
