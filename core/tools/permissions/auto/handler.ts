import type { ToolPolicy } from "@continuedev/terminal-security";
import type { ILLM } from "../../..";
import type { ApprovalSettings } from "../approval";
import { DecisionSource } from "../decide";
import { EvaluateInput, evaluateToolPolicyWithRules } from "../evaluate";
import type { ToolPermissions } from "../rules";
import { ReviewCategory } from "./categories";
import { ReviewResult } from "./parse";
import { ReviewEnvironment, ReviewHistory } from "./prompt";
import {
  DEFAULT_REVIEW_TIMEOUT_MS,
  reviewToolCall,
  ReviewerReasoning,
  unavailable,
} from "./review";
import { AutoReviewSessions } from "./state";

export interface AutoReviewRequest {
  sessionId: string;
  toolName: string;
  basePolicy: ToolPolicy;
  parsedArgs: Record<string, unknown>;
  processedArgs?: Record<string, unknown>;
  history: ReviewHistory;
  /** Approval mode and switches; absent means Manual. */
  approval?: ApprovalSettings;
  /** No person to ask: an unusable reviewer refuses. */
  headless?: boolean;
}

export interface AutoReviewReply {
  decision: "allow" | "ask" | "deny";
  reason: string;
  category?: ReviewCategory;
  /**
   * Who decided. "rules" means the deterministic engine (a deny, ask or allow
   * rule, a protected path, the safety floor, or an allowed policy) and the
   * reviewer was not asked. "reviewer" is the model. "system" is Auto itself
   * (unavailable, off, or a refusal cap).
   */
  by: "rules" | "reviewer" | "system";
  /** For `by: "rules"`: which rule or check decided. */
  ruleSource?: DecisionSource;
  /** The command or path, for showing a refusal. */
  displayValue?: string;
  cached?: boolean;
  /** The reviewer's reply could not be read, so the call was left for the user. */
  unusable?: boolean;
}

export interface AutoReviewDeps {
  tool: EvaluateInput["tool"];
  permissions: ToolPermissions | undefined;
  /** `experimental.enableAutoApproval`. */
  enabled: boolean;
  /** The model chosen for the reviewer role; never a chat model. */
  reviewer: Pick<ILLM, "chat"> | null | undefined;
  /** `modeModels.reviewer.reasoningEffort`, as completion options. */
  reviewerReasoning?: ReviewerReasoning;
  environment: ReviewEnvironment;
  sessions: AutoReviewSessions;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/** Sources where the user or the safety floor already spoke: the reviewer cannot move them. */
const FINAL_SOURCES: DecisionSource[] = [
  "deny-rule",
  "ask-rule",
  "allow-rule",
  "protected-path",
  "safety-floor",
];

/**
 * Decide one call in Auto mode.
 *
 * Order (plans/tool-auto-approval.md section 5): the deterministic engine runs
 * first and anything it settles is returned as is. Only a call it leaves open,
 * that is an "ask" that came from the tool's own setting or default and not
 * from a rule, a protected path or the safety floor, reaches the reviewer. The
 * reviewer can turn that ask into allow or deny, never the other way round.
 */
export async function autoReviewToolCall(
  deps: AutoReviewDeps,
  req: AutoReviewRequest,
): Promise<AutoReviewReply> {
  const evaluated = evaluateToolPolicyWithRules({
    tool: deps.tool,
    toolName: req.toolName,
    basePolicy: req.basePolicy,
    parsedArgs: req.parsedArgs,
    processedArgs: req.processedArgs,
    permissions: deps.permissions,
    approval: req.approval,
  });
  const base = { displayValue: evaluated.displayValue };
  const settled = (
    decision: AutoReviewReply["decision"],
    fallback: string,
  ): AutoReviewReply => ({
    ...base,
    decision,
    by: "rules",
    ruleSource: evaluated.source,
    reason: evaluated.reason ?? fallback,
  });

  if (evaluated.policy === "disabled") {
    return settled("deny", "Refused by a rule or the safety check.");
  }
  if (evaluated.policy === "allowedWithoutPermission") {
    return settled("allow", "Allowed without review.");
  }
  if (evaluated.source && FINAL_SOURCES.includes(evaluated.source)) {
    return settled("ask", "Your rules ask before this runs.");
  }

  // The call is open. From here Auto is the only thing that may loosen it.
  const system = (result: ReviewResult): AutoReviewReply => ({
    ...base,
    ...result,
    by: "system",
  });
  if (!deps.enabled) {
    return system(unavailable("Auto approval is turned off.", false));
  }
  if (!deps.reviewer) {
    return system(
      unavailable(
        "Choose a reviewer model in Settings > Models.",
        req.headless,
      ),
    );
  }

  const state = deps.sessions.get(req.sessionId);
  const limits = deps.permissions?.auto?.limits;
  const cached = state.cached(req.toolName, req.parsedArgs);
  const raw =
    cached ??
    (await reviewToolCall(
      deps.reviewer,
      {
        toolName: req.toolName,
        args: req.parsedArgs,
        history: req.history,
        environment: deps.environment,
        settings: deps.permissions?.auto,
      },
      {
        timeoutMs: deps.timeoutMs ?? DEFAULT_REVIEW_TIMEOUT_MS,
        signal: deps.signal,
        headless: req.headless,
        reasoning: deps.reviewerReasoning,
      },
    ));
  if (!cached) state.remember(req.toolName, req.parsedArgs, raw);

  const result = state.record(raw, limits);
  const by =
    result.category === "reviewer-unavailable" ||
    result.category === "denial-limit"
      ? "system"
      : "reviewer";
  return { ...base, ...result, by, ...(cached ? { cached: true } : {}) };
}
