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
