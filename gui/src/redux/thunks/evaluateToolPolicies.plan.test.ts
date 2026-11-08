import { describe, expect, it, vi } from "vitest";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import {
  evaluateToolPolicies,
  evaluateToolPolicy,
  PLAN_MODE_HOLD_REASON,
} from "./evaluateToolPolicies";

const ASK = "allowedWithPermission" as const;
const ALLOW = "allowedWithoutPermission" as const;
const OFF = "disabled" as const;

function call(name: string) {
  return {
    toolCallId: `id-${name}`,
    toolCall: {
      id: "x",
      type: "function",
      function: { name, arguments: "{}" },
    },
    parsedArgs: {},
    status: "generated",
  } as any;
}

const mcpTool = {
  function: { name: "github_create_issue" },
  group: "github",
  readonly: false,
} as any;
const readTool = {
  function: { name: "read_file" },
  group: "Built-In",
  readonly: true,
} as any;

async function run(
  name: string,
  reply: any,
  mode: "plan" | "agent",
  { auto = false, toolPolicies = {} as Record<string, any> } = {},
) {
  const ide = new MockIdeMessenger();
  ide.responseHandlers["tools/evaluatePolicy"] = async () => reply;
  const review = vi.fn(async () => ({
    decision: "allow",
    by: "model",
    reason: "looks fine",
  }));
  ide.responseHandlers["tools/autoReview"] = review as any;
  const dispatch = vi.fn();
  const [result] = await evaluateToolPolicies(
    dispatch as any,
    ide,
    [mcpTool, readTool],
    [call(name)],
    toolPolicies,
    auto
      ? { sessionId: "s", history: { userMessages: [], toolCalls: [] } }
      : undefined,
    undefined,
    mode,
  );
  return { result, dispatch, review };
}

describe("Plan mode holds tools that may make changes", () => {
  it("asks before an MCP tool set to run on its own", async () => {
    const { result, dispatch } = await run(
      "github_create_issue",
      { policy: ALLOW },
      "plan",
      { toolPolicies: { github_create_issue: ALLOW } },
    );
    expect(result.policy).toBe(ASK);
    expect(result.source).toBe("plan-mode");
    // The prompt says why a tool set to run on its own is waiting
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ note: PLAN_MODE_HOLD_REASON }),
      }),
    );
  });

  it("asks even when the user's allow rule or approval mode allowed it", async () => {
    for (const source of ["allow-rule", "category", "yolo"]) {
      const { result } = await run(
        "github_create_issue",
        { policy: ALLOW, source },
        "plan",
        { toolPolicies: { github_create_issue: ALLOW } },
      );
      expect(result.policy).toBe(ASK);
    }
  });

  it("YOLO does not lift it: Plan mode changes nothing", async () => {
    const ide = new MockIdeMessenger();
    ide.responseHandlers["tools/evaluatePolicy"] = async () =>
      ({ policy: ALLOW, source: "yolo" }) as any;
    const result = await evaluateToolPolicy(
      ide,
      [mcpTool],
      call("github_create_issue"),
      { github_create_issue: ALLOW },
      { mode: "yolo" },
      "plan",
    );
    expect(result.policy).toBe(ASK);
    expect(result.source).toBe("plan-mode");
  });

  it("leaves the hold to the user, not the Auto reviewer", async () => {
    const { result, review } = await run(
      "github_create_issue",
      { policy: ALLOW },
      "plan",
      { auto: true, toolPolicies: { github_create_issue: ALLOW } },
    );
    expect(result.policy).toBe(ASK);
    expect(review).not.toHaveBeenCalled();
  });

  it("lets read-only tools run on their own", async () => {
    const { result } = await run("read_file", { policy: ALLOW }, "plan", {
      toolPolicies: { read_file: ALLOW },
    });
    expect(result.policy).toBe(ALLOW);
  });

  it("keeps refusals", async () => {
    const { result } = await run(
      "github_create_issue",
      { policy: OFF, source: "deny-rule" },
      "plan",
    );
    expect(result.policy).toBe(OFF);
  });

  it("changes nothing outside Plan mode", async () => {
    const { result } = await run(
      "github_create_issue",
      { policy: ALLOW },
      "agent",
      { toolPolicies: { github_create_issue: ALLOW } },
    );
    expect(result.policy).toBe(ALLOW);
  });
});
