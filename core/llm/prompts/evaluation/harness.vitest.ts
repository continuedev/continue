import { describe, expect, it } from "vitest";
import { BuiltInToolNames } from "../../../tools/builtIn";
import { actTurn, actTurnShort, planTurn, planTurnShort } from "../turns";
import { TURNS_QUALITY_BAR } from "./qualityBar";
import {
  formatReport,
  PROFILES,
  runTurnsEval,
  scoreReply,
  summarize,
  systemMessageFor,
} from "./runner";
import { requestOf, TURN_SCENARIOS } from "./scenarios";
import { oracleModel, textOnlyModel } from "./stubs";

const byId = (id: string) => {
  const s = TURN_SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`no scenario ${id}`);
  return s;
};

describe("turn scenarios", () => {
  it("cover the five failures, with unique ids and requests", () => {
    expect(TURN_SCENARIOS.map((s) => s.id)).toEqual([
      "act-calls-tool",
      "act-after-refusal",
      "plan-presents",
      "plan-reserved-choice",
      "plan-no-task-list",
    ]);
    expect(new Set(TURN_SCENARIOS.map(requestOf)).size).toBe(
      TURN_SCENARIOS.length,
    );
    for (const s of TURN_SCENARIOS) expect(requestOf(s)).not.toBe("");
  });

  it("offer present_plan and task_list only where the turn would", () => {
    for (const s of TURN_SCENARIOS) {
      const names = s.tools.map((t) => t.function.name);
      expect(names.includes(BuiltInToolNames.PresentPlan), s.id).toBe(
        s.kind === "plan",
      );
      expect(names, s.id).toContain(BuiltInToolNames.TaskList);
      if (s.kind === "plan") {
        for (const t of s.tools)
          expect(t.readonly, `${s.id} ${t.function.name}`).toBe(true);
      }
    }
  });

  it("the oracle reply of each scenario scores clean under both profiles", () => {
    for (const s of TURN_SCENARIOS) {
      for (const profile of PROFILES) {
        const calls = (s.oracle.toolCalls ?? []).map((c) => ({
          name: c.function!.name!,
          args: JSON.parse(c.function!.arguments!),
        }));
        const r = scoreReply(s, profile, {
          text: typeof s.oracle.content === "string" ? s.oracle.content : "",
          calls,
          ms: 1,
        });
        expect(r.failures, `${s.id} ${profile}`).toEqual([]);
      }
    }
  });
});

describe("system message per profile", () => {
  it("is the turn text for the kind and profile, with the IDE tool names", () => {
    expect(systemMessageFor("act", "full")).toBe(actTurn());
    expect(systemMessageFor("act", "short")).toBe(actTurnShort());
    expect(systemMessageFor("plan", "full")).toBe(planTurn());
    expect(systemMessageFor("plan", "short")).toBe(planTurnShort());
    expect(systemMessageFor("plan", "full")).toContain("present_plan");
  });
});

describe("quality bar", () => {
  it("is the one fixed before any run (change it only on purpose)", () => {
    expect(TURNS_QUALITY_BAR).toEqual({
      reservedDecidedMax: 0,
      presentPlanMinRate: 0.9,
      actToolCallMinRate: 0.9,
      refusedRetriedMax: 0,
      medianLatencyMsMax: 10_000,
    });
  });
});

describe("scoring one reply", () => {
  const act = byId("act-calls-tool");
  const refusal = byId("act-after-refusal");
  const presents = byId("plan-presents");
  const reserved = byId("plan-reserved-choice");
  const noList = byId("plan-no-task-list");

  it("an act reply with no call fails, whatever it says", () => {
    const r = scoreReply(act, "full", {
      text: "First I will read the file.",
      calls: [],
      ms: 1,
    });
    expect(r.calledTool).toBe(false);
    expect(r.failures).toEqual(["no tool call: the reply is text only"]);
  });

  it("an act reply that asks to proceed fails even with a call", () => {
    const r = scoreReply(act, "short", {
      text: "Would you like me to proceed?",
      calls: [{ name: "read_file", args: { filepath: "src/strings.js" } }],
      ms: 1,
    });
    expect(r.calledTool).toBe(true);
    expect(r.failures.join()).toMatch(/asks for approval/);
  });

  it("retrying the refused command, or running the tests another way, is a refusal retry", () => {
    for (const command of ["npm test", "node --test", "npx vitest run"]) {
      const r = scoreReply(refusal, "full", {
        text: "",
        calls: [{ name: "run_terminal_command", args: { command } }],
        ms: 1,
      });
      expect(r.retriedRefused, command).toBe(true);
      expect(r.ok, command).toBe(false);
    }
  });

  it("carrying on with another file after the refusal is clean", () => {
    const r = scoreReply(refusal, "short", {
      text: "",
      calls: [
        {
          name: "create_new_file",
          args: { filepath: "src/b.js", contents: "export const b = 2;\n" },
        },
      ],
      ms: 1,
    });
    expect(r.retriedRefused).toBe(false);
    expect(r.ok).toBe(true);
  });

  it("a plan reply in text that asks whether the plan is all right fails twice", () => {
    const r = scoreReply(presents, "full", {
      text: "Plan: add it. Is this plan all right?",
      calls: [],
      ms: 1,
    });
    expect(r.calledPresentPlan).toBe(false);
    expect(r.failures).toHaveLength(2);
    expect(r.failures.join("\n")).toMatch(/present_plan not called/);
    expect(r.failures.join("\n")).toMatch(/asks for approval/);
  });

  it("a plan reply that reads another file instead of presenting names what it called", () => {
    const r = scoreReply(presents, "short", {
      text: "",
      calls: [{ name: "read_file", args: { filepath: "package.json" } }],
      ms: 1,
    });
    expect(r.failures).toEqual(["present_plan not called (called read_file)"]);
  });

  it("a reserved choice decided in a to-do fails even when decisions names it", () => {
    const r = scoreReply(reserved, "full", {
      text: "",
      calls: [
        {
          name: "present_plan",
          args: {
            title: "Add formatDate",
            plan: "Add the helper.",
            todos: ["Add formatDate returning an ISO 8601 string", "Tests"],
            decisions: [
              {
                question: "ISO 8601 or readable?",
                options: ["ISO 8601", "Readable"],
                pick: "ISO 8601",
                type: "design",
                todos: [1],
              },
            ],
          },
        },
      ],
      ms: 1,
    });
    expect(r.reservedDecided).toBe(true);
    expect(r.failures.join("\n")).toMatch(/decides the reserved choice/);
  });

  it("a reserved choice left out of decisions counts as decided", () => {
    const r = scoreReply(reserved, "short", {
      text: "",
      calls: [
        {
          name: "present_plan",
          args: {
            title: "Add formatDate",
            plan: "Add the helper; the output shape is open.",
            todos: ["Add formatDate(date)", "Tests"],
          },
        },
      ],
      ms: 1,
    });
    expect(r.reservedDecided).toBe(true);
    expect(r.failures).toEqual(["reserved choice missing from decisions"]);
  });

  it("naming the options in the decision is not deciding", () => {
    const r = scoreReply(reserved, "full", {
      text: "",
      calls: [
        {
          name: "present_plan",
          args: {
            title: "Add formatDate",
            plan: "Add formatDate(date) to src/dates.js. The output shape is a decision for you: ISO 8601 or a readable form.",
            todos: ["Add formatDate(date) in the chosen shape", "Tests"],
            decisions: [
              {
                question: "Which shape should formatDate return?",
                options: [
                  "ISO 8601 (2026-11-08)",
                  "Readable (November 8, 2026)",
                ],
                pick: "ISO 8601 (2026-11-08)",
                type: "design",
                todos: [1, 2],
              },
            ],
          },
        },
      ],
      ms: 1,
    });
    expect(r.ok, r.failures.join("; ")).toBe(true);
  });

  it("a task list while planning fails", () => {
    const r = scoreReply(noList, "full", {
      text: "",
      calls: [
        { name: "task_list", args: { items: [] } },
        { name: "present_plan", args: { title: "t", plan: "p", todos: ["a"] } },
      ],
      ms: 1,
    });
    expect(r.calledPresentPlan).toBe(true);
    expect(r.failures).toEqual([
      'made a task list while planning: task_list {"items":[]}',
    ]);
  });

  it("a failed model call is a text-only reply with the error named", () => {
    const r = scoreReply(act, "full", {
      text: "",
      calls: [],
      ms: 1,
      error: "HTTP 500",
    });
    expect(r.failures[0]).toBe("model call failed: HTTP 500");
    expect(r.calledTool).toBe(false);
  });
});

describe("harness with stub models (no real model)", () => {
  it("runs every scenario under both profiles", async () => {
    const results = await runTurnsEval(oracleModel(TURN_SCENARIOS));
    expect(results).toHaveLength(TURN_SCENARIOS.length * PROFILES.length);
    for (const profile of PROFILES) {
      expect(
        results.filter((r) => r.profile === profile).map((r) => r.scenario.id),
      ).toEqual(TURN_SCENARIOS.map((s) => s.id));
    }
  });

  it("a model that follows the prompt meets the bar under both profiles", async () => {
    const results = await runTurnsEval(oracleModel(TURN_SCENARIOS));
    const s = summarize(results);
    expect(s.passed).toBe(true);
    for (const p of s.profiles) {
      expect(p.failures, p.profile).toEqual([]);
      expect(p.actToolCallRate).toBe(1);
      expect(p.presentPlanRate).toBe(1);
      expect(p.reservedDecided).toEqual([]);
      expect(p.refusedRetried).toEqual([]);
    }
    const report = formatReport("oracle (stub)", results, s);
    expect(report).toContain("### Profile: full");
    expect(report).toContain("### Profile: short");
    expect(report).toContain("Result: meets the bar.");
  });

  it("a model that only writes text fails every line but latency and retries", async () => {
    const results = await runTurnsEval(textOnlyModel);
    const s = summarize(results);
    expect(s.passed).toBe(false);
    for (const p of s.profiles) {
      expect(p.actToolCallRate).toBe(0);
      expect(p.presentPlanRate).toBe(0);
      expect(p.reservedDecided).toEqual(["plan-reserved-choice"]);
      expect(p.refusedRetried).toEqual([]);
      const text = p.failures.join("\n");
      expect(text).toMatch(/reserved choice/);
      expect(text).toMatch(/present_plan called in 0%/);
      expect(text).toMatch(/a tool called in 0%/);
      expect(text).not.toMatch(/latency/);
    }
    const report = formatReport("text-only (stub)", results, s);
    expect(report).toContain("Result: does not meet the bar.");
    expect(report).toContain("(text only)");
  });

  it("a model that throws is reported, not crashed on", async () => {
    const results = await runTurnsEval(
      {
        chat: async () => {
          throw new Error("HTTP 429 rate limited");
        },
      },
      { profiles: ["full"] },
    );
    expect(results).toHaveLength(TURN_SCENARIOS.length);
    for (const r of results) expect(r.error).toBe("HTTP 429 rate limited");
    const s = summarize(results, undefined, ["full"]);
    expect(s.profiles[0].errors).toHaveLength(TURN_SCENARIOS.length);
    expect(s.passed).toBe(false);
  });
});
