import { describe, expect, it, vi } from "vitest";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { grantKey } from "../slices/blockedCallsSlice";
import { evaluateToolPolicies } from "./evaluateToolPolicies";

const ASK = "allowedWithPermission" as const;
const ALLOW = "allowedWithoutPermission" as const;
const OFF = "disabled" as const;

function call(name: string, parsedArgs: Record<string, unknown> = {}) {
  return {
    toolCallId: `id-${name}`,
    toolCall: {
      id: "x",
      type: "function",
      function: { name, arguments: "{}" },
    },
    parsedArgs,
    status: "generated",
  } as any;
}

const args = { command: "npm test" };

async function run(policyReply: any, reviewReply?: any, onceGrants?: string[]) {
  const ide = new MockIdeMessenger();
  ide.responseHandlers["tools/evaluatePolicy"] = async () => policyReply;
  const review = vi.fn(async () => reviewReply);
  ide.responseHandlers["tools/autoReview"] = review as any;
  const dispatch = vi.fn();
  const auto = reviewReply
    ? {
        sessionId: "s",
        history: { userMessages: [], toolCalls: [] },
        onceGrants,
      }
    : undefined;
  await evaluateToolPolicies(
    dispatch as any,
    ide,
    [],
    [call("run_terminal_command", args)],
    {},
    auto,
  );
  const actions = dispatch.mock.calls.map((c) => c[0]);
  return { actions, review };
}

const named = (actions: any[], suffix: string) =>
  actions.filter((a) => a.type?.endsWith(suffix));

describe("decision chip data", () => {
  it("records why a call ran without asking", async () => {
    for (const source of ["allow-rule"]) {
      const { actions } = await run({
        policy: ALLOW,
        source,
        reason: "because",
        rule: "r",
      });
      const [d] = named(actions, "setToolCallDecision");
      expect(d.payload.decision).toMatchObject({
        outcome: "allowed",
        source,
        reason: "because",
        rule: "r",
      });
    }
  });

  it("records nothing for a call that simply was allowed by its setting", async () => {
    const { actions } = await run({ policy: ALLOW, source: "tool-setting" });
    expect(named(actions, "setToolCallDecision")).toHaveLength(0);
  });

  it("records the reviewer's allow", async () => {
    const { actions } = await run(
      { policy: ASK },
      { decision: "allow", reason: "Runs tests.", by: "reviewer" },
    );
    const [d] = named(actions, "setToolCallDecision");
    expect(d.payload.decision).toMatchObject({
      outcome: "allowed",
      source: "auto",
    });
    expect(d.payload.decision.reason).toContain("Runs tests.");
  });

  it("records a deny rule refusal and lists it as blocked", async () => {
    const { actions } = await run({
      policy: OFF,
      source: "deny-rule",
      reason: "Blocked by your rule x",
      rule: "x",
      displayValue: "npm test",
    });
    const [d] = named(actions, "setToolCallDecision");
    expect(d.payload.decision).toMatchObject({
      outcome: "blocked",
      source: "deny-rule",
      rule: "x",
    });
    const [b] = named(actions, "addBlockedCall");
    expect(b.payload).toMatchObject({
      toolName: "run_terminal_command",
      summary: "npm test",
      source: "deny-rule",
    });
  });

  it("records the reviewer's refusal with its category", async () => {
    const { actions } = await run(
      { policy: ASK },
      {
        decision: "deny",
        category: "production-impact",
        reason: "Targets prod.",
        by: "reviewer",
      },
    );
    const [b] = named(actions, "addBlockedCall");
    expect(b.payload).toMatchObject({
      source: "auto",
      category: "production-impact",
      reason: "Targets prod.",
    });
  });
});

describe("allow once", () => {
  it("lets the exact call through without asking the reviewer, and uses the grant up", async () => {
    const { actions, review } = await run(
      { policy: ASK },
      { decision: "deny", category: "production-impact", reason: "x" },
      [grantKey("run_terminal_command", args)],
    );
    expect(review).not.toHaveBeenCalled();
    const [d] = named(actions, "setToolCallDecision");
    expect(d.payload.decision).toMatchObject({
      outcome: "allowed",
      source: "once",
    });
    expect(named(actions, "consumeGrant")).toHaveLength(1);
  });

  it("does not apply to a different call", async () => {
    const { review } = await run(
      { policy: ASK },
      { decision: "ask", reason: "x", by: "reviewer" },
      [grantKey("run_terminal_command", { command: "other" })],
    );
    expect(review).toHaveBeenCalled();
  });

  it("never overrides a rule: a deny rule still refuses despite a grant", async () => {
    const { actions, review } = await run(
      { policy: OFF, source: "deny-rule" },
      { decision: "allow", reason: "x" },
      [grantKey("run_terminal_command", args)],
    );
    expect(review).not.toHaveBeenCalled();
    expect(named(actions, "errorToolCall")).toHaveLength(1);
    expect(named(actions, "consumeGrant")).toHaveLength(0);
  });

  it("never overrides a protected path that asks", async () => {
    const { actions } = await run(
      { policy: ASK, source: "protected-path", reason: "protected" },
      { decision: "allow", reason: "x" },
      [grantKey("run_terminal_command", args)],
    );
    expect(named(actions, "consumeGrant")).toHaveLength(0);
    expect(named(actions, "setToolCallPolicyNote")).toHaveLength(1);
  });
});
