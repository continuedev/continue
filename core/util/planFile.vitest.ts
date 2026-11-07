import type { TaskPlan } from "../index.js";
import { describe, expect, it } from "vitest";
import {
  choosePlanFileName,
  parsePlanFile,
  planBuildMessage,
  planKeepPlanningResult,
  serializePlanFile,
  slugifyPlanTitle,
  taskPlanForProposal,
  taskPlanFromPlanFile,
  validatePlanArgs,
} from "./planFile";
import { parseMarkdownChecklist } from "./taskPlan";

const now = new Date("2026-11-06T12:00:00.000Z");

function plan(items: TaskPlan["items"], updatedBy?: "model" | "user") {
  return { items, updatedAt: now.toISOString(), updatedBy } as TaskPlan;
}

describe("plan file format", () => {
  const doc = {
    title: "Add retry to the uploader",
    body: "Uploads fail on a flaky network.\n\n- Retry three times\n- Back off",
    items: [
      { id: "1", text: "Add a retry helper", status: "completed" as const },
      { id: "2", text: "Use it in upload()", status: "in_progress" as const },
      { id: "7", text: "Write the tests", status: "pending" as const },
    ],
  };

  it("writes a title, the body and a to-do list with ids", () => {
    expect(serializePlanFile(doc)).toBe(
      [
        "# Add retry to the uploader",
        "",
        "Uploads fail on a flaky network.",
        "",
        "- Retry three times",
        "- Back off",
        "",
        "## To-dos",
        "",
        "- [x] Add a retry helper <!-- id: 1 -->",
        "- [>] Use it in upload() <!-- id: 2 -->",
        "- [ ] Write the tests <!-- id: 7 -->",
        "",
      ].join("\n"),
    );
  });

  it("round-trips, keeping ids, statuses and the body's own bullets", () => {
    const parsed = parsePlanFile(serializePlanFile(doc));
    expect(parsed).toEqual({
      title: doc.title,
      body: doc.body,
      items: doc.items,
    });
  });

  it("reads a file a person wrote: no ids, other heading, CRLF", () => {
    const md =
      "# Plan\r\n\r\nSome text.\r\n\r\n### Steps\r\n\r\n- [ ] One\r\n- [X] Two\r\n\r\n## Notes\r\n\r\nAfter.\r\n";
    expect(parsePlanFile(md)).toEqual({
      title: "Plan",
      body: "Some text.\n\n## Notes\n\nAfter.",
      items: [
        { text: "One", status: "pending" },
        { text: "Two", status: "completed" },
      ],
    });
  });

  it("without a to-do heading, takes every checkbox line", () => {
    const md = "# T\n\nIntro\n- [ ] a\n- [x] b\nOutro\n";
    const parsed = parsePlanFile(md);
    expect(parsed.items.map((i) => i.text)).toEqual(["a", "b"]);
    expect(parsed.body).toBe("Intro\nOutro");
  });

  it("names a file without a title Plan", () => {
    expect(parsePlanFile("- [ ] a").title).toBe("Plan");
  });
});

describe("parseMarkdownChecklist id comments", () => {
  it("reads the id and strips the comment from the text", () => {
    expect(
      parseMarkdownChecklist("- [ ] Do it <!-- id: a-1 -->\n- [x] Plain"),
    ).toEqual([
      { id: "a-1", text: "Do it", status: "pending" },
      { text: "Plain", status: "completed" },
    ]);
  });
});

describe("file names", () => {
  it("slugifies titles", () => {
    expect(slugifyPlanTitle("Add retry to the Uploader!")).toBe(
      "add-retry-to-the-uploader",
    );
    expect(slugifyPlanTitle("Café über")).toBe("cafe-uber");
    expect(slugifyPlanTitle("???")).toBe("plan");
    expect(slugifyPlanTitle("a".repeat(100)).length).toBe(60);
  });

  it("adds a number when the name is taken", async () => {
    const taken = new Set(["x.md", "x-2.md"]);
    expect(await choosePlanFileName("X", (n) => taken.has(n))).toBe("x-3.md");
    expect(await choosePlanFileName("Y", async () => false)).toBe("y.md");
  });
});

describe("validatePlanArgs", () => {
  it("accepts strings and objects as to-dos, all pending", () => {
    const r = validatePlanArgs({
      title: " T ",
      plan: "Body",
      todos: ["One", { text: "Two" }],
    });
    expect(r).toEqual({
      ok: true,
      title: "T",
      body: "Body",
      items: [
        { text: "One", status: "pending" },
        { text: "Two", status: "pending" },
      ],
    });
  });

  it("accepts to-dos as a JSON string or a markdown list", () => {
    const json = validatePlanArgs({ title: "T", todos: '["a","b"]' });
    expect(json.ok && json.items.length).toBe(2);
    const md = validatePlanArgs({ title: "T", todos: "- [ ] a\n- [ ] b" });
    expect(md.ok && md.items.map((i) => i.text)).toEqual(["a", "b"]);
  });

  it("refuses a missing title or no to-dos", () => {
    expect(validatePlanArgs({ todos: ["a"] }).ok).toBe(false);
    expect(validatePlanArgs({ title: "T", todos: [] }).ok).toBe(false);
    expect(validatePlanArgs({ title: "T", todos: [""] }).ok).toBe(false);
  });
});

describe("task list from a plan", () => {
  it("a proposal replaces the list and keeps ids of matching text", () => {
    const previous = plan([
      { id: "4", text: "Keep me", status: "completed" },
      { id: "5", text: "Old", status: "pending" },
    ]);
    const r = taskPlanForProposal(
      [
        { text: "New", status: "pending" },
        { text: "Keep me", status: "pending" },
      ],
      previous,
      now,
    );
    expect(r.ok && r.plan.items).toEqual([
      { id: "5", text: "New", status: "pending" },
      { id: "4", text: "Keep me", status: "pending" },
    ]);
  });

  it("reading back an unedited file changes nothing", () => {
    const previous = plan(
      [
        { id: "1", text: "A", status: "pending", activeForm: "Doing A" },
        { id: "2", text: "B", status: "pending" },
      ],
      "model",
    );
    const md = serializePlanFile({ title: "T", body: "", ...previous });
    const r = taskPlanFromPlanFile(md, previous, now);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.changed).toBe(false);
    expect(r.plan.items).toEqual(previous.items);
    expect(r.plan.updatedBy).toBe("model");
  });

  it("the person's edits win and mark the list as edited", () => {
    const previous = plan([
      { id: "1", text: "A", status: "pending" },
      { id: "2", text: "B", status: "pending" },
    ]);
    const md = [
      "# T",
      "",
      "## To-dos",
      "",
      "- [x] A <!-- id: 1 -->",
      "- [ ] B, but better",
      "- [ ] B",
      "- [ ] C",
    ].join("\n");
    const r = taskPlanFromPlanFile(md, previous, now);
    expect(r.ok && r.changed).toBe(true);
    expect(r.ok && r.plan.updatedBy).toBe("user");
    expect(r.ok && r.plan.items).toEqual([
      { id: "1", text: "A", status: "completed" },
      { id: "3", text: "B, but better", status: "pending" },
      { id: "2", text: "B", status: "pending" },
      { id: "4", text: "C", status: "pending" },
    ]);
  });

  it("reports a file the list rules refuse", () => {
    const md = "# T\n\n## To-dos\n\n- [>] a\n- [>] b\n";
    const r = taskPlanFromPlanFile(md, undefined, now);
    expect(r.ok).toBe(false);
  });
});

describe("messages", () => {
  it("Build names the file, says to re-read it and keep the list", () => {
    const text = planBuildMessage(".continue/plans/x.md");
    expect(text).toContain(".continue/plans/x.md");
    expect(text).toMatch(/Read the file first/);
    expect(text).toMatch(/task list current/);
  });

  it("keep planning passes feedback on", () => {
    expect(planKeepPlanningResult("smaller steps")).toContain("smaller steps");
    expect(planKeepPlanningResult()).toMatch(/Stay in Plan mode/);
  });
});
