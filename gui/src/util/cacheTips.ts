import type { ModelDescription } from "core";
import { bedrockRegionalPriceFactor } from "core/llm/utils/calculateRequestCost";
import {
  replayAll,
  type CacheLedgerEntry,
  type ReplayPolicy,
} from "./cacheLedger";
import { NOTICE_MIN_EXTRA_USD } from "./cacheSafeguards";
import { formatUsd } from "./cacheNotices";
import { countFailures, type RequestFailure } from "./requestFailures";
import {
  configEnablesPromptCaching,
  configTtlPolicy,
  modelSupportsOneHourCache,
  modelSupportsPromptCacheControl,
  type PromptCacheSetting,
} from "./promptCache";

/** Requests the session needs before its own history is worth advising from. */
export const REPLAY_MIN_REQUESTS = 6;
/** The saving must be at least this share of what the session cost. */
export const REPLAY_MIN_SAVING_SHARE = 0.1;
/**
 * The replay of what really happened must land within this band of the cost
 * computed from the recorded tokens, or it is not trusted for this session.
 */
export const REPLAY_FIDELITY_BAND = 0.15;

const POLICY_LABEL: Record<ReplayPolicy, string> = {
  off: "caching off",
  "5m": "the 5-minute cache",
  "1h": "the 1-hour cache",
  auto: "Auto",
};

/**
 * Advice about the model and cache settings in use. Each tip comes from a
 * vendor's documentation (named in the comment on the rule), says what to
 * change, and says when the advice does not apply.
 */
export interface CacheTip {
  /** Stable, used to remember a dismissal. */
  id: string;
  severity: "warning" | "info";
  title: string;
  body: string;
  /** A model ID to try, shown so it can be copied into config.yaml. */
  suggestion?: string;
}

/** `us.anthropic.claude-sonnet-4-6` -> `global.anthropic.claude-sonnet-4-6`. */
export function globalModelId(modelId: string): string {
  return modelId.replace(/^(us|eu|apac|jp|au|ca)\./i, "global.");
}

/** Throttled requests in a conversation before the throttling tip appears. */
export const THROTTLE_TIP_MIN = 2;

/** The key under which a dismissal is stored. */
export function cacheTipKey(modelTitle: string, tipId: string): string {
  return `${modelTitle}::${tipId}`;
}

/** How many tips the user has dismissed for this model. */
export function dismissedTipCount(
  dismissed: Record<string, true> | undefined,
  modelTitle: string,
): number {
  const prefix = cacheTipKey(modelTitle, "");
  return Object.keys(dismissed ?? {}).filter((k) => k.startsWith(prefix))
    .length;
}

export function cacheTips(
  model: ModelDescription | null | undefined,
  setting: PromptCacheSetting | undefined,
  /** This conversation's requests so far; enables the tips drawn from it. */
  ledger?: CacheLedgerEntry[],
  /** This conversation's failed requests; enables the throttling tip. */
  failures?: RequestFailure[],
  /**
   * Whether the account lists the global profile of this model, when it has
   * been checked. Without it (or when "unknown") the regional-premium tip
   * suggests the global ID as before.
   */
  globalProfile?: "present" | "absent" | "unknown",
): CacheTip[] {
  if (!model) return [];
  const tips: CacheTip[] = [];
  const fromSession = sessionReplayTip(ledger);

  // Anthropic's pricing page: "Regional and multi-region endpoints include a
  // 10 percent premium over global endpoints" (Sonnet 4.5, Haiku 4.5, Opus 4.5
  // and later). On Bedrock the endpoint type is the model ID's prefix.
  if (model.provider?.toLowerCase() === "bedrock") {
    const factor = bedrockRegionalPriceFactor(model.model);
    if (factor > 1) {
      const percent = Math.round((factor - 1) * 100);
      const noGlobal = globalProfile === "absent";
      tips.push({
        id: "regional-premium",
        severity: noGlobal ? "info" : "warning",
        title: `Regional endpoints cost ${percent}% more`,
        body: noGlobal
          ? `This model ID uses a regional endpoint, which Anthropic prices ${percent}% above a global one, on input, output and cache reads and writes. ` +
            `Your account does not list a global profile for this model, so there is nothing cheaper to switch to here.`
          : `This model ID uses a regional endpoint, which Anthropic prices ${percent}% above a global one, ` +
            `on input, output and cache reads and writes. If your data does not have to stay in that geography, ` +
            `try the global ID if one exists for this model. Global endpoints can route a request to any region, ` +
            `so keep the regional one when data residency matters.`,
        ...(!noGlobal && { suggestion: globalModelId(model.model) }),
      });
    }
  }

  // AWS Bedrock prompt caching guide: only the models in its table take a
  // 1-hour `ttl`; sending one to the others "can result in a
  // ValidationException", so Continued sends the 5-minute default instead.
  if (modelSupportsPromptCacheControl(model)) {
    const on =
      setting === undefined
        ? configEnablesPromptCaching(model)
        : setting !== "off";
    const policy = setting ?? configTtlPolicy(model);
    if (on && !modelSupportsOneHourCache(model)) {
      if (policy === "1h") {
        tips.push({
          id: "one-hour-unavailable",
          severity: "warning",
          title: "1 hour is not available for this model",
          body: "Bedrock lists a 1-hour cache only for some models, and this is not one of them. Requests use the 5-minute lifetime instead, so a pause longer than 5 minutes rewrites the whole conversation.",
        });
      } else if (policy === "auto") {
        tips.push({
          id: "one-hour-unavailable",
          severity: "info",
          title: "Auto stays at 5 minutes for this model",
          body: "Auto moves to a 1-hour cache after a pause or several requests, but Bedrock lists a 1-hour cache only for some models and this is not one of them.",
        });
      }
    }
  }

  const throttle = throttlingTip(model, setting, failures);
  if (throttle) tips.push(throttle);

  if (fromSession) tips.push(fromSession);
  return tips;
}

/**
 * Replays this conversation's recorded requests under each lifetime and says
 * so when a different one would have cost clearly less. The input side only
 * (output tokens do not change with caching), from the tokens the API reported.
 *
 * Stays quiet unless the replay can be trusted: enough requests, a replay of
 * what really happened that agrees with the recorded cost, a priced model, and
 * a saving that is both worth a dollar figure and a real share of the bill.
 */
function sessionReplayTip(
  ledger: CacheLedgerEntry[] | undefined,
): CacheTip | undefined {
  if (!ledger || ledger.length < REPLAY_MIN_REQUESTS) return undefined;
  const r = replayAll(ledger);
  if (!r) return undefined;
  if (Math.abs(r.fidelity - 1) > REPLAY_FIDELITY_BAND) return undefined;

  const bestUsd = r.usd[r.best];
  if (bestUsd === undefined) return undefined;
  const saving = r.actualUsd - bestUsd;
  if (saving < NOTICE_MIN_EXTRA_USD) return undefined;
  if (saving < r.actualUsd * REPLAY_MIN_SAVING_SHARE) return undefined;

  const pct = Math.round((saving / r.actualUsd) * 100);
  const how =
    r.best === "off"
      ? "Turn caching off for conversations like this one."
      : `Choose ${POLICY_LABEL[r.best]} in the cache menu.`;
  return {
    id: `replay-best-${r.best}`,
    severity: "info",
    title: `${POLICY_LABEL[r.best][0].toUpperCase()}${POLICY_LABEL[r.best].slice(1)} would have cost about ${pct}% less here`,
    body:
      `Replaying this conversation's ${r.requests} requests (their sizes and the pauses between them), the input side cost ` +
      `about ${formatUsd(r.actualUsd)} and would have cost about ${formatUsd(bestUsd)} with ${POLICY_LABEL[r.best]}. ${how} ` +
      `This is an estimate from the token counts the provider reported. It assumes the same requests would have been sent, and it ` +
      `ignores output tokens, which caching does not change.`,
  };
}

/**
 * Throttled with caching off. AWS ("How tokens are counted in Amazon Bedrock"):
 * a request uses quota for its uncached input, its cache writes and its output
 * (times a burndown rate), and tokens read from a cache are not counted.
 * Anthropic's prompt caching page says the same of its rate limit: cache hits
 * are not deducted. So a conversation that is being throttled with caching
 * off is spending quota on input that caching would have left out.
 *
 * Not said: that caching ends throttling (output and cache writes still count,
 * and so does a burst of requests), or that a global endpoint throttles less
 * (nothing read says so). Overloaded errors are the provider's capacity, not
 * the account's quota, so they do not count here. OpenAI's own documentation
 * says cached tokens still count toward its limits, which is why this tip is
 * limited to the Anthropic and Bedrock models the cache button covers.
 */
function throttlingTip(
  model: ModelDescription,
  setting: PromptCacheSetting | undefined,
  failures: RequestFailure[] | undefined,
): CacheTip | undefined {
  if (!modelSupportsPromptCacheControl(model)) return undefined;
  const on =
    setting === undefined
      ? configEnablesPromptCaching(model)
      : setting !== "off";
  if (on) return undefined;
  const { throttled } = countFailures(failures);
  if (throttled < THROTTLE_TIP_MIN) return undefined;
  const where =
    model.provider?.toLowerCase() === "bedrock" ? "Bedrock" : "Anthropic";
  return {
    id: "throttled-caching-off",
    severity: "warning",
    title: `Throttled ${throttled} times with caching off`,
    body:
      `${where} does not count tokens read from a cache against your rate limit, but with caching off every input token of every request counts. ` +
      `Turning caching on can reduce how often this conversation is throttled. It will not stop throttling by itself: output tokens and cache writes still count, and so does a burst of requests.`,
  };
}
