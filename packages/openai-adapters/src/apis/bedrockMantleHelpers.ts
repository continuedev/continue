/**
 * Pure helpers for the Bedrock Mantle provider (OpenAI-compatible endpoint
 * `bedrock-mantle.<region>.api.aws`). Kept free of imports so they can be
 * shared with the GUI and tested without the OpenAI client.
 */

/**
 * Regions that have a `bedrock-mantle` endpoint (AWS "Regional availability by
 * endpoints"). `bedrock-runtime` is available in more regions.
 */
export const MANTLE_REGIONS = [
  "us-east-1",
  "us-east-2",
  "us-west-2",
  "eu-central-1",
  "eu-north-1",
  "eu-south-1",
  "eu-west-1",
  "eu-west-2",
  "ap-northeast-1",
  "ap-south-1",
  "ap-southeast-2",
  "ap-southeast-3",
  "sa-east-1",
  "us-gov-east-1",
  "us-gov-west-1",
] as const;

export function isMantleRegion(region: string | undefined): boolean {
  return !!region && (MANTLE_REGIONS as readonly string[]).includes(region);
}

/** Path prefixes Mantle serves models under; most use /v1, some /openai/v1. */
export const MANTLE_PATH_PREFIXES = ["/v1", "/openai/v1"] as const;

/** Accepts "v1", "/v1/", "openai/v1" and returns "/v1" or "/openai/v1" style. */
export function normalizeMantlePrefix(
  prefix: string | undefined,
): string | undefined {
  if (!prefix) return undefined;
  const trimmed = prefix.trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}` : undefined;
}

/** Base URL (with trailing slash, as the OpenAI client expects). */
export function mantleBaseUrl(region: string, prefix = "/v1"): string {
  const p = normalizeMantlePrefix(prefix) ?? "/v1";
  return `https://bedrock-mantle.${region}.api.aws${p}/`;
}

/** The other documented prefix, for retrying a "wrong route" rejection. */
export function alternateMantlePrefix(prefix: string): string {
  return normalizeMantlePrefix(prefix) === "/openai/v1" ? "/v1" : "/openai/v1";
}

/** Mantle rejects a model requested on the wrong prefix with this message. */
export function isWrongRouteError(message: string): boolean {
  return /isn.?t supported on this route/i.test(message);
}

export type MaxTokensParam = "max_tokens" | "max_completion_tokens";

/**
 * Some models reject `max_tokens` (and, in principle, others reject
 * `max_completion_tokens`). Returns the parameter to switch to, or undefined
 * when the error is not about the token-limit parameter.
 */
export function maxTokensParamFromError(
  message: string,
): MaxTokensParam | undefined {
  if (/unsupported parameter:?\s*'?max_tokens'?/i.test(message)) {
    return "max_completion_tokens";
  }
  if (/unsupported parameter:?\s*'?max_completion_tokens'?/i.test(message)) {
    return "max_tokens";
  }
  return undefined;
}

export interface MantleModelOption {
  id: string;
  name: string;
  provider: string;
  kind: "on-demand";
}

const VENDOR_NAMES: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  qwen: "Qwen",
  deepseek: "DeepSeek",
  moonshotai: "Moonshot AI",
  mistral: "Mistral AI",
  meta: "Meta",
  google: "Google",
  zai: "Z.AI",
  minimax: "MiniMax",
  nvidia: "NVIDIA",
  xai: "xAI",
  amazon: "Amazon",
};

/** Turn `GET /models` ids (`openai.gpt-oss-120b`) into picker options. */
export function mantleModelOptions(ids: string[]): MantleModelOption[] {
  return [...new Set(ids)]
    .map((id) => {
      const vendor = id.includes(".") ? id.split(".")[0] : "other";
      return {
        id,
        name: id,
        provider:
          VENDOR_NAMES[vendor] ??
          vendor.charAt(0).toUpperCase() + vendor.slice(1),
        kind: "on-demand" as const,
      };
    })
    .sort(
      (a, b) =>
        a.provider.localeCompare(b.provider) || a.id.localeCompare(b.id),
    );
}

/** One-line next step for common Mantle failures, or undefined. */
export function getMantleErrorHint(
  message: string,
  ctx: { region?: string },
): string | undefined {
  if (isWrongRouteError(message)) {
    return "This model is served under a different path prefix. Set `mantlePathPrefix` to `/v1` or `/openai/v1` (see the model card under Programmatic Access).";
  }
  if (/ENOTFOUND|getaddrinfo|Could not resolve host|EAI_AGAIN/i.test(message)) {
    return isMantleRegion(ctx.region)
      ? `Could not reach bedrock-mantle in ${ctx.region}. Check your network/proxy.`
      : `bedrock-mantle isn't available in ${ctx.region ?? "this region"}. Mantle regions: ${MANTLE_REGIONS.join(", ")}.`;
  }
  if (
    /\b(401|403)\b|unauthorized|forbidden|invalid.*(api )?key|access ?denied/i.test(
      message,
    )
  ) {
    return "Authentication failed. Use a Bedrock API key for the same region, and make sure its IAM principal allows bedrock-mantle:CreateInference.";
  }
  if (/\b404\b|not found/i.test(message) && /models?/i.test(message)) {
    return "Model not found on this endpoint. Check the model ID with Test connection, and the path prefix (`/v1` vs `/openai/v1`).";
  }
  return undefined;
}
