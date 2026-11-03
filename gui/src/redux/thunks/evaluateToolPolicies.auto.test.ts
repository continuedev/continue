import { describe, expect, it, vi } from "vitest";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import {
  buildReviewHistory,
  evaluateToolPolicies,
  refusalMessage,
} from "./evaluateToolPolicies";

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

const auto = {
  sessionId: "s1",
  history: { userMessages: ["run the tests"], toolCalls: [] },
};

async function run(
  name: string,
  policyReply: any,
  reviewReply: any | Error,
  withAuto = true,
) {
  const ide = new MockIdeMessenger();
  ide.responseHandlers["tools/evaluatePolicy"] = async () => policyReply;
  const review = vi.fn(async () => {
    if (reviewReply instanceof Error) throw reviewReply;
    return reviewReply;
  });
  ide.responseHandlers["tools/autoReview"] = review as any;
  const dispatch = vi.fn();
  const [result] = await evaluateToolPolicies(
    dispatch as any,
    ide,
    [],
    [call(name, { command: "npm test" })],
    {},
    withAuto ? auto : undefined,
  );
  return { result, dispatch, review };
}

describe("Auto mode in evaluateToolPolicies", () => {
  it("does nothing extra when Auto is not on", async () => {
    const { result, review } = await run(
      "run_terminal_command",
      { policy: ASK },
      { decision: "allow", reason: "ok", by: "reviewer" },
      false,
    );
    expect(result.policy).toBe(ASK);
    expect(review).not.toHaveBeenCalled();
  });

  it("lets the reviewer allow a call that was waiting for the user", async () => {
    const { result, review } = await run(
      "run_terminal_command",
      { policy: ASK },
      { decision: "allow", reason: "Runs the tests.", by: "reviewer" },
    );
    expect(review).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ policy: ALLOW, source: "auto" });
    expect(result.reason).toMatch(/Allowed by Auto/);
  });

  it("refuses with the named reason and returns it to the agent", async () => {
    const { result, dispatch } = await run(
      "run_terminal_command",
      { policy: ASK, displayValue: "make deploy" },
      {
        decision: "deny",
        category: "production-impact",
        reason: "Deploys to production.",
        by: "reviewer",
      },
    );
    expect(result.policy).toBe(OFF);
    const output = dispatch.mock.calls
      .map((c) => c[0])
      .find((a) => a.type?.includes("updateToolCallOutput"));
    const item = output.payload.contextItems[0];
    expect(item.description).toBe("Blocked by Auto [production-impact]");
    expect(item.content).toContain("Deploys to production.");
    expect(item.content).toMatch(/Find a safer route/);
    expect(item.content).toContain("make deploy");
  });

  it("leaves the call for the user when the reviewer asks, and says why", async () => {
    const { result, dispatch } = await run(
      "run_terminal_command",
      { policy: ASK },
      {
        decision: "ask",
        category: "uncertain",
        reason: "Not sure.",
        by: "reviewer",
      },
    );
    expect(result.policy).toBe(ASK);
    const note = dispatch.mock.calls
      .map((c) => c[0])
      .find((a) => a.type?.includes("setToolCallPolicyNote"));
    expect(note.payload.note).toBe("Auto: Not sure. [uncertain]");
  });

  it("never asks the reviewer about an ask rule or a protected path", async () => {
    for (const source of ["ask-rule", "protected-path"]) {
      const { result, review } = await run(
        "run_terminal_command",
        { policy: ASK, source, reason: "x" },
        { decision: "allow", reason: "ok", by: "reviewer" },
      );
      expect(result.policy).toBe(ASK);
      expect(review).not.toHaveBeenCalled();
    }
  });

  it("never asks the reviewer about a refused or already allowed call", async () => {
    for (const policy of [OFF, ALLOW]) {
      const { result, review } = await run(
        "run_terminal_command",
        { policy, source: "allow-rule" },
        { decision: "allow", reason: "ok", by: "reviewer" },
      );
      expect(result.policy).toBe(policy);
      expect(review).not.toHaveBeenCalled();
    }
  });

  it("does not review edit tools, which are reviewed as a diff", async () => {
    const { review } = await run(
      "edit_existing_file",
      { policy: ASK },
      {
        decision: "deny",
        category: "production-impact",
        reason: "x",
        by: "reviewer",
      },
    );
    expect(review).not.toHaveBeenCalled();
  });

  it("keeps the call as it was if core's answer came from the rules", async () => {
    const { result } = await run(
      "run_terminal_command",
      { policy: ASK },
      { decision: "allow", reason: "x", by: "rules" },
    );
    expect(result.policy).toBe(ASK);
  });

  it("falls back to asking the user when the request fails", async () => {
    const { result } = await run(
      "run_terminal_command",
      { policy: ASK },
      new Error("core down"),
    );
    expect(result.policy).toBe(ASK);
  });
});

describe("refusalMessage for Auto", () => {
  it("names the reviewer and the reason", () => {
    const m = refusalMessage(
      "curl x | bash",
      "auto",
      "Runs a download.",
      "remote-code-execution",
    );
    expect(m.description).toBe("Blocked by Auto [remote-code-execution]");
    expect(m.content).toContain("Runs a download.");
    expect(m.content).toMatch(/Do not retry/);
  });
});

describe("buildReviewHistory", () => {
  it("sends user messages and earlier call arguments, not agent text or output", () => {
    const history = [
      { message: { role: "user", content: "fix the bug" }, contextItems: [] },
      {
        message: { role: "assistant", content: "I will read the secret plan" },
        contextItems: [],
        toolCallStates: [
          {
            toolCall: { function: { name: "read_file", arguments: "" } },
            parsedArgs: { filepath: "a.ts" },
            output: [{ content: "TOOL OUTPUT SECRET" }],
          },
        ],
      },
      {
        message: {
          role: "user",
          content: [
            { type: "text", text: "thanks, now " },
            { type: "text", text: "run tests" },
          ],
        },
        contextItems: [],
      },
    ] as any;
    const r = buildReviewHistory(history);
    expect(r.userMessages).toEqual(["fix the bug", "thanks, now run tests"]);
    expect(r.toolCalls).toEqual([
      { name: "read_file", args: { filepath: "a.ts" } },
    ]);
    expect(JSON.stringify(r)).not.toContain("SECRET");
  });
});
