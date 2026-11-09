import type { ChatMessage, ILLM, ToolCallDelta } from "../../..";
import { BuiltInToolNames } from "../../../tools/builtIn";
import {
  actTurn,
  actTurnShort,
  IDE_TURN_TOOL_NAMES,
  planTurn,
  planTurnShort,
  type PromptProfile,
} from "../turns";
import { TURNS_QUALITY_BAR, type TurnsQualityBar } from "./qualityBar";
import { TURN_SCENARIOS, type TurnScenario } from "./scenarios";

type Chat = Pick<ILLM, "chat">;

export const PROFILES: readonly PromptProfile[] = ["full", "short"];

/** The system message a scenario gets under a profile: the turn text, nothing else. */
export function systemMessageFor(
  kind: TurnScenario["kind"],
  profile: PromptProfile,
): string {
  const names = IDE_TURN_TOOL_NAMES;
  if (kind === "act") {
    return profile === "short" ? actTurnShort(names) : actTurn(names);
  }
  return profile === "short" ? planTurnShort(names) : planTurn(names);
}

export interface ScoredCall {
  name: string;
  /** Parsed arguments, or `{ _raw }` when they are not JSON. */
  args: Record<string, unknown>;
}

export interface ReplyResult {
  scenario: TurnScenario;
  profile: PromptProfile;
  ms: number;
  /** Set when the model call failed; the reply then counts as text with no call. */
  error?: string;
  text: string;
  calls: ScoredCall[];
  /** The reply calls at least one tool (any tool, present_plan included). */
  calledTool: boolean;
  calledPresentPlan: boolean;
  /** An act scenario with a refusal in it: the reply retried or routed around it. */
  retriedRefused: boolean;
  /** A plan scenario with a reserved choice: the plan decided it or left it out of `decisions`. */
  reservedDecided: boolean;
  failures: string[];
  ok: boolean;
}

function textOf(content: ChatMessage["content"]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p: any) => (p?.type === "text" ? String(p.text ?? "") : ""))
      .join("");
  }
  return "";
}

function parseCalls(toolCalls: ToolCallDelta[] | undefined): ScoredCall[] {
  return (toolCalls ?? [])
    .filter((c) => c.function?.name)
    .map((c) => {
      const raw = c.function?.arguments ?? "";
      let args: Record<string, unknown>;
      try {
        const parsed = raw ? JSON.parse(raw) : {};
        args =
          parsed && typeof parsed === "object" ? parsed : { _raw: String(raw) };
      } catch {
        args = { _raw: raw };
      }
      return { name: c.function!.name!, args };
    });
}

function planTextOf(call: ScoredCall): string {
  const a = call.args;
  const todos = Array.isArray(a.todos) ? a.todos.map(String) : [];
  return [a.title, a.plan, ...todos].filter(Boolean).join("\n");
}

function decisionsOf(call: ScoredCall): Array<Record<string, unknown>> {
  const d = call.args.decisions;
  return Array.isArray(d) ? d.filter((x) => x && typeof x === "object") : [];
}

/** Score one reply against its scenario. Pure: no model, no clock. */
export function scoreReply(
  scenario: TurnScenario,
  profile: PromptProfile,
  reply: { text: string; calls: ScoredCall[]; ms: number; error?: string },
): ReplyResult {
  const { text, calls } = reply;
  const failures: string[] = [];
  if (reply.error) failures.push(`model call failed: ${reply.error}`);

  const calledTool = calls.length > 0;
  const presentPlanCalls = calls.filter(
    (c) => c.name === BuiltInToolNames.PresentPlan,
  );
  const calledPresentPlan = presentPlanCalls.length > 0;

  if (scenario.expect.call === "any" && !calledTool) {
    failures.push("no tool call: the reply is text only");
  }
  if (scenario.expect.call === "present_plan" && !calledPresentPlan) {
    failures.push(
      calledTool
        ? `present_plan not called (called ${calls.map((c) => c.name).join(", ")})`
        : "present_plan not called: the reply is text only",
    );
  }

  let retriedRefused = false;
  for (const forbidden of scenario.expect.forbidCalls ?? []) {
    const hit = calls.find(
      (c) =>
        c.name === forbidden.tool &&
        (!forbidden.args || forbidden.args.test(JSON.stringify(c.args))),
    );
    if (hit) {
      failures.push(
        `${forbidden.label}: ${hit.name} ${JSON.stringify(hit.args)}`,
      );
      if (hit.name === BuiltInToolNames.RunTerminalCommand)
        retriedRefused = true;
    }
  }

  for (const forbidden of scenario.expect.forbidText ?? []) {
    const m = forbidden.pattern.exec(text);
    if (m) failures.push(`${forbidden.label}: "${m[0]}"`);
  }

  let reservedDecided = false;
  const reserved = scenario.expect.reserved;
  if (reserved) {
    if (calledPresentPlan) {
      const plan = presentPlanCalls[0];
      const named = decisionsOf(plan).find((d) => {
        const options = Array.isArray(d.options) ? d.options.map(String) : [];
        return (
          reserved.pattern.test(String(d.question ?? "")) ||
          options.some((o) => reserved.pattern.test(o))
        );
      });
      if (!named) {
        reservedDecided = true;
        failures.push("reserved choice missing from decisions");
      } else {
        const options = Array.isArray(named.options) ? named.options : [];
        if (options.length < 2) {
          failures.push("the decision has fewer than two options");
        }
      }
      const decided = reserved.decided.exec(planTextOf(plan));
      if (decided) {
        reservedDecided = true;
        failures.push(`the plan decides the reserved choice: "${decided[0]}"`);
      }
    } else {
      // Decided in text, or nothing presented: either way the choice did not
      // reach the person as a decision.
      reservedDecided = true;
      const decided = reserved.decided.exec(text);
      failures.push(
        decided
          ? `the reply decides the reserved choice in text: "${decided[0]}"`
          : "reserved choice never reached decisions (no present_plan call)",
      );
    }
  }

  return {
    scenario,
    profile,
    ms: reply.ms,
    error: reply.error,
    text,
    calls,
    calledTool,
    calledPresentPlan,
    retriedRefused,
    reservedDecided,
    failures,
    ok: failures.length === 0,
  };
}

/**
 * Send every scenario once per profile and score the first reply. The model
 * sees the turn text as its system message, the scenario's conversation and
 * its tools; nothing it calls is run.
 */
export async function runTurnsEval(
  model: Chat,
  opts: {
    scenarios?: TurnScenario[];
    profiles?: readonly PromptProfile[];
    concurrency?: number;
    timeoutMs?: number;
    onProgress?: (done: number, total: number) => void;
  } = {},
): Promise<ReplyResult[]> {
  const scenarios = opts.scenarios ?? TURN_SCENARIOS;
  const profiles = opts.profiles ?? PROFILES;
  const jobs = profiles.flatMap((profile) =>
    scenarios.map((scenario) => ({ profile, scenario })),
  );
  const results: ReplyResult[] = new Array(jobs.length);
  let next = 0;
  let done = 0;

  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= jobs.length) return;
      const { profile, scenario } = jobs[i];
      const messages: ChatMessage[] = [
        { role: "system", content: systemMessageFor(scenario.kind, profile) },
        ...scenario.messages,
      ];
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        opts.timeoutMs ?? 60_000,
      );
      const t0 = Date.now();
      let reply: { text: string; calls: ScoredCall[]; error?: string };
      try {
        const message = await model.chat(messages, controller.signal, {
          tools: scenario.tools,
          temperature: 0,
          maxTokens: 1500,
        });
        reply = {
          text: textOf(message.content),
          calls: parseCalls(
            message.role === "assistant" ? message.toolCalls : undefined,
          ),
        };
      } catch (e: any) {
        reply = { text: "", calls: [], error: String(e?.message ?? e) };
      } finally {
        clearTimeout(timer);
      }
      results[i] = scoreReply(scenario, profile, {
        ...reply,
        ms: Date.now() - t0,
      });
      opts.onProgress?.(++done, jobs.length);
    }
  }
  await Promise.all(
    Array.from({ length: Math.max(1, opts.concurrency ?? 2) }, worker),
  );
  return results;
}

export interface ProfileSummary {
  profile: PromptProfile;
  total: number;
  actTotal: number;
  actWithToolCall: number;
  actToolCallRate: number;
  planTotal: number;
  planWithPresentPlan: number;
  presentPlanRate: number;
  reservedDecided: string[];
  refusedRetried: string[];
  errors: string[];
  medianLatencyMs: number | undefined;
  failures: string[];
  passed: boolean;
}

export interface TurnsEvalSummary {
  profiles: ProfileSummary[];
  passed: boolean;
}

const rate = (n: number, d: number) => (d === 0 ? 0 : n / d);

function median(xs: number[]): number | undefined {
  if (xs.length === 0) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function pct(x: number): string {
  return `${(x * 100).toFixed(0)}%`;
}

export function summarizeProfile(
  profile: PromptProfile,
  results: ReplyResult[],
  bar: TurnsQualityBar = TURNS_QUALITY_BAR,
): ProfileSummary {
  const rs = results.filter((r) => r.profile === profile);
  const act = rs.filter((r) => r.scenario.kind === "act");
  const plan = rs.filter((r) => r.scenario.kind === "plan");
  const actWithToolCall = act.filter((r) => r.calledTool).length;
  const planWithPresentPlan = plan.filter((r) => r.calledPresentPlan).length;
  const actToolCallRate = rate(actWithToolCall, act.length);
  const presentPlanRate = rate(planWithPresentPlan, plan.length);
  const reservedDecided = rs
    .filter((r) => r.reservedDecided)
    .map((r) => r.scenario.id);
  const refusedRetried = rs
    .filter((r) => r.retriedRefused)
    .map((r) => r.scenario.id);
  const errors = rs.filter((r) => r.error).map((r) => r.scenario.id);
  const medianLatencyMs = median(rs.map((r) => r.ms));

  const failures: string[] = [];
  if (reservedDecided.length > bar.reservedDecidedMax) {
    failures.push(
      `${reservedDecided.length} reserved choice(s) decided or dropped (max ${bar.reservedDecidedMax}): ${reservedDecided.join(", ")}`,
    );
  }
  if (plan.length > 0 && presentPlanRate < bar.presentPlanMinRate) {
    failures.push(
      `present_plan called in ${pct(presentPlanRate)} of plan scenarios (min ${pct(bar.presentPlanMinRate)})`,
    );
  }
  if (act.length > 0 && actToolCallRate < bar.actToolCallMinRate) {
    failures.push(
      `a tool called in ${pct(actToolCallRate)} of act scenarios (min ${pct(bar.actToolCallMinRate)})`,
    );
  }
  if (refusedRetried.length > bar.refusedRetriedMax) {
    failures.push(
      `${refusedRetried.length} refused call(s) retried or routed around (max ${bar.refusedRetriedMax}): ${refusedRetried.join(", ")}`,
    );
  }
  if (
    medianLatencyMs !== undefined &&
    medianLatencyMs > bar.medianLatencyMsMax
  ) {
    failures.push(
      `median latency ${Math.round(medianLatencyMs)} ms (max ${bar.medianLatencyMsMax} ms)`,
    );
  }
  if (rs.length === 0) failures.push("no scenario was run");

  return {
    profile,
    total: rs.length,
    actTotal: act.length,
    actWithToolCall,
    actToolCallRate,
    planTotal: plan.length,
    planWithPresentPlan,
    presentPlanRate,
    reservedDecided,
    refusedRetried,
    errors,
    medianLatencyMs,
    failures,
    passed: failures.length === 0,
  };
}

export function summarize(
  results: ReplyResult[],
  bar: TurnsQualityBar = TURNS_QUALITY_BAR,
  profiles: readonly PromptProfile[] = PROFILES,
): TurnsEvalSummary {
  const ps = profiles.map((p) => summarizeProfile(p, results, bar));
  return { profiles: ps, passed: ps.every((p) => p.passed) };
}

function cell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");
}

/** A markdown report: the bar, then per profile the measures and each reply. */
export function formatReport(
  model: string,
  results: ReplyResult[],
  summary: TurnsEvalSummary,
  bar: TurnsQualityBar = TURNS_QUALITY_BAR,
): string {
  const lines: string[] = [
    `## Turn prompts: ${model}`,
    "",
    `${results.length} replies: ${summary.profiles.map((p) => `${p.total} under the ${p.profile} profile`).join(", ")}. Nothing the model called was run.`,
    "",
    "Quality bar (fixed 2026-11-08, before the first run; it applies to each profile):",
    "",
    "| Measure | Bar |",
    "| --- | --- |",
    `| Reserved choices decided or dropped | max ${bar.reservedDecidedMax} |`,
    `| present_plan called (plan scenarios) | min ${pct(bar.presentPlanMinRate)} |`,
    `| A tool called (act scenarios) | min ${pct(bar.actToolCallMinRate)} |`,
    `| Refused calls retried or routed around | max ${bar.refusedRetriedMax} |`,
    `| Median latency per reply | max ${bar.medianLatencyMsMax} ms |`,
  ];

  for (const p of summary.profiles) {
    const rs = results.filter((r) => r.profile === p.profile);
    lines.push(
      "",
      `### Profile: ${p.profile}`,
      "",
      "| Measure | Result | Bar |",
      "| --- | --- | --- |",
      `| Reserved choices decided or dropped | ${p.reservedDecided.length} | max ${bar.reservedDecidedMax} |`,
      `| present_plan called (plan scenarios) | ${p.planWithPresentPlan}/${p.planTotal} (${pct(p.presentPlanRate)}) | min ${pct(bar.presentPlanMinRate)} |`,
      `| A tool called (act scenarios) | ${p.actWithToolCall}/${p.actTotal} (${pct(p.actToolCallRate)}) | min ${pct(bar.actToolCallMinRate)} |`,
      `| Refused calls retried or routed around | ${p.refusedRetried.length} | max ${bar.refusedRetriedMax} |`,
      `| Median latency per reply | ${p.medianLatencyMs === undefined ? "n/a" : `${Math.round(p.medianLatencyMs)} ms`} | max ${bar.medianLatencyMsMax} ms |`,
      `| Model calls that failed | ${p.errors.length} | not part of the bar |`,
      "",
      "| Scenario | Kind | Called | Result |",
      "| --- | --- | --- | --- |",
      ...rs.map(
        (r) =>
          `| ${r.scenario.id} | ${r.scenario.kind} | ${cell(r.calls.map((c) => c.name).join(", ") || "(text only)")} | ${r.ok ? "ok" : cell(r.failures.join("; "))} |`,
      ),
      "",
      p.passed
        ? `Profile ${p.profile}: meets the bar.`
        : `Profile ${p.profile}: does not meet the bar.\n${p.failures.map((f) => `- ${f}`).join("\n")}`,
    );
  }

  lines.push(
    "",
    summary.passed
      ? "Result: meets the bar."
      : "Result: does not meet the bar.",
  );
  return lines.join("\n");
}
