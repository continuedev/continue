import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { TaskPlan } from "../index.js";
import {
  appendTaskPlanBlock,
  buildTaskPlan,
  formatTaskPlanBlock,
  formatTaskProgress,
  isTaskPlan,
  parseMarkdownChecklist,
  TASK_LIST_BLOCK_OPEN,
  TASK_PLAN_LIMITS,
  taskPlanConfirmation,
} from "./taskPlan.js";

const now = new Date("2026-11-06T12:00:00.000Z");

function plan(items: unknown[], previous?: TaskPlan, reset?: boolean) {
  const result = buildTaskPlan(items, { previous, reset, now });
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.plan;
}

describe("buildTaskPlan", () => {
  it("assigns ids, defaults the status and records the time", () => {
    const p = plan([{ text: "One" }, { text: "Two", status: "in_progress" }]);
    expect(p.items).toEqual([
      { id: "1", text: "One", status: "pending" },
      { id: "2", text: "Two", status: "in_progress" },
    ]);
    expect(p.updatedAt).toBe(now.toISOString());
    expect(p.updatedBy).toBe("model");
  });

  it("allows at most one item in progress", () => {
    const result = buildTaskPlan([
      { text: "a", status: "in_progress" },
      { text: "b", status: "in_progress" },
    ]);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/at most one/);
  });

  it("caps the item count and the text length", () => {
    const many = Array.from(
      { length: TASK_PLAN_LIMITS.maxItems + 1 },
      (_, i) => ({
        text: `t${i}`,
      }),
    );
    expect(buildTaskPlan(many).ok).toBe(false);
    expect(
      buildTaskPlan([{ text: "x".repeat(TASK_PLAN_LIMITS.maxTextLength + 1) }])
        .ok,
    ).toBe(false);
    expect(buildTaskPlan([{ text: "   " }]).ok).toBe(false);
    expect(buildTaskPlan([{ text: "a", status: "done" }]).ok).toBe(false);
    expect(buildTaskPlan("not a list").ok).toBe(false);
  });

  it("rejects duplicate ids", () => {
    expect(
      buildTaskPlan([
        { id: "1", text: "a" },
        { id: "1", text: "b" },
      ]).ok,
    ).toBe(false);
  });

  it("keeps ids stable: given ids, then same text, then the next number", () => {
    const first = plan([{ text: "a" }, { text: "b" }]);
    const second = plan(
      [
        { text: "b", status: "in_progress" },
        { id: "1", text: "a renamed" },
        { text: "c" },
      ],
      first,
    );
    expect(second.items.map((i) => [i.id, i.text])).toEqual([
      ["2", "b"],
      ["1", "a renamed"],
      ["3", "c"],
    ]);
  });

  it("keeps completed items the list leaves out, and drops open ones", () => {
    const first = plan([
      { text: "done", status: "completed" },
      { text: "open" },
      { text: "next" },
    ]);
    const second = plan(
      [{ id: "3", text: "next", status: "in_progress" }],
      first,
    );
    expect(second.items.map((i) => i.text)).toEqual(["done", "next"]);
    expect(plan([{ text: "new" }], first, true).items).toEqual([
      { id: "1", text: "new", status: "pending" },
    ]);
  });

  it("drops the oldest kept completed items to stay under the cap", () => {
    const full = plan(
      Array.from({ length: TASK_PLAN_LIMITS.maxItems }, (_, i) => ({
        text: `old ${i}`,
        status: "completed",
      })),
    );
    const next = plan([{ text: "fresh" }], full);
    expect(next.items).toHaveLength(TASK_PLAN_LIMITS.maxItems);
    expect(next.items[0].text).toBe("old 1");
    expect(next.items.at(-1)).toMatchObject({ text: "fresh", id: "51" });
  });

  it("keeps notes and activeForm, trimmed", () => {
    const p = plan([
      {
        text: "Deploy",
        status: "blocked",
        note: " waiting for keys ",
        activeForm: "Deploying",
      },
    ]);
    expect(p.items[0]).toEqual({
      id: "1",
      text: "Deploy",
      status: "blocked",
      note: "waiting for keys",
      activeForm: "Deploying",
    });
    expect(isTaskPlan(p)).toBe(true);
    expect(isTaskPlan({ items: [{ id: 1 }] })).toBe(false);
  });
});

describe("formatTaskPlanBlock", () => {
  it("is empty without items", () => {
    expect(formatTaskPlanBlock(undefined)).toBe("");
    expect(appendTaskPlanBlock([], { items: [], updatedAt: "" })).toEqual([]);
  });

  it("writes one line per item with markers, notes for blocked and cancelled", () => {
    const p = plan([
      { text: "a", status: "completed" },
      { text: "b", status: "in_progress", activeForm: "Doing b" },
      { text: "c", status: "blocked", note: "needs keys" },
      { text: "d", status: "cancelled", note: "not needed" },
      { text: "e", note: "ignored for pending" },
    ]);
    const lines = formatTaskPlanBlock(p).split("\n");
    expect(lines[0]).toBe(TASK_LIST_BLOCK_OPEN);
    // Says what the block is before saying how to change it, so the list is
    // not read as an instruction to resend it
    expect(lines[1]).toMatch(
      /^This is your saved task list; it is shown with every request\./,
    );
    expect(lines[1]).toContain("never to resend it unchanged");
    expect(lines[1]).toContain("Markers: [ ] pending");
    expect(lines.slice(2)).toEqual([
      "[x] 1. a",
      "[>] 2. b",
      "[!] 3. c (needs keys)",
      "[-] 4. d (not needed)",
      "[ ] 5. e",
      "</task_list>",
    ]);
  });

  it("folds completed items beyond the last few into a count", () => {
    const p = plan(
      Array.from({ length: 6 }, (_, i) => ({
        text: `step ${i + 1}`,
        status: "completed",
      })).concat([{ text: "last", status: "in_progress" }]),
    );
    const block = formatTaskPlanBlock(p);
    expect(block).toContain("[x] 3 earlier items completed (not shown)");
    expect(block).not.toContain("step 3");
    expect(block).toContain("[x] 4. step 4");
    expect(block).toContain("[>] 7. last");
  });

  it("says when the person edited the list", () => {
    const p = { ...plan([{ text: "a" }]), updatedBy: "user" as const };
    expect(formatTaskPlanBlock(p)).toContain("The user edited this list");
  });

  it("is deterministic", () => {
    const p = plan([{ text: "a" }, { text: "b", status: "completed" }]);
    expect(formatTaskPlanBlock(p)).toBe(
      formatTaskPlanBlock(structuredClone(p)),
    );
  });

  it("goes after the history, as the last message", () => {
    const p = plan([{ text: "a" }]);
    const history = [
      { role: "system" as const, content: "s" },
      { role: "user" as const, content: "u" },
    ];
    const out = appendTaskPlanBlock(history, p);
    expect(out.slice(0, 2)).toEqual(history);
    expect(out[2]).toEqual({ role: "user", content: formatTaskPlanBlock(p) });
    expect(history).toHaveLength(2);
  });

  it("uses the same tag as the openai-adapters Bedrock conversion", () => {
    const adapter = fs.readFileSync(
      path.join(
        __dirname,
        "../../packages/openai-adapters/src/apis/Bedrock.ts",
      ),
      "utf8",
    );
    expect(adapter).toContain(
      `export const TASK_LIST_BLOCK_OPEN = ${JSON.stringify(TASK_LIST_BLOCK_OPEN)};`,
    );
  });
});

describe("progress and confirmation", () => {
  it("shows done/total and the in-progress label", () => {
    const p = plan([
      { text: "a", status: "completed" },
      { text: "b", status: "cancelled" },
      {
        text: "Run migrations",
        status: "in_progress",
        activeForm: "Running migrations",
      },
      { text: "d" },
    ]);
    expect(formatTaskProgress(p)).toBe("2/4 Running migrations");
    expect(formatTaskProgress(undefined)).toBe("");
    expect(formatTaskProgress(plan([{ text: "a", status: "completed" }]))).toBe(
      "1/1 done",
    );
    const confirmation = taskPlanConfirmation(p);
    expect(confirmation).toContain("2/4 done");
    expect(confirmation).toContain("In progress: 3. Run migrations");
    expect(confirmation).not.toContain("[ ]");
  });
});

describe("parseMarkdownChecklist", () => {
  it("maps checkbox lines and ignores the rest", () => {
    expect(
      parseMarkdownChecklist(
        "Plan:\n- [x] one\n- [ ] two\n  - [>] three\n* [!] four\n1. [-] five\n- [ ]   \nplain",
      ),
    ).toEqual([
      { text: "one", status: "completed" },
      { text: "two", status: "pending" },
      { text: "three", status: "in_progress" },
      { text: "four", status: "blocked" },
      { text: "five", status: "cancelled" },
    ]);
  });

  it("gives indented after:, check: and model: lines to the item above", () => {
    expect(
      parseMarkdownChecklist(
        [
          "- [ ] one",
          "  after: 2",
          "  check: npm test",
          "  model: Claude Opus",
          "- [ ] two",
          "\tmodel: fast",
          "model: not indented",
        ].join("\n"),
      ),
    ).toEqual([
      {
        text: "one",
        status: "pending",
        after: "2",
        check: "npm test",
        model: "Claude Opus",
      },
      { text: "two", status: "pending", model: "fast" },
    ]);
  });
});
