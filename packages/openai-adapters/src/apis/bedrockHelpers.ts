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
