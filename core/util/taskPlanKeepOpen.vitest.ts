import { describe, expect, test } from "vitest";

import type { TaskPlan } from "../index.js";

import { buildTaskPlan } from "./taskPlan.js";

function eight(): TaskPlan {
  const built = buildTaskPlan(
    Array.from({ length: 8 }, (_, i) => ({ text: `To-do ${i + 1}` })),
  );
  if (!built.ok) throw new Error(built.error);
  return built.plan;
}

function update(items: unknown[], previous: TaskPlan) {
  const built = buildTaskPlan(items, { previous, keepOpen: true });
  if (!built.ok) throw new Error(built.error);
  return built.plan.items;
}

describe("a partial update while building from a plan", () => {
  test("found in a real session: two items sent, six to-dos kept", () => {
    const items = update(
      [
        { id: "1", text: "To-do 1", status: "completed" },
        { id: "2", text: "To-do 2", status: "in_progress" },
      ],
      eight(),
    );
    expect(items).toHaveLength(8);
    expect(items.slice(0, 3).map((i) => i.status)).toEqual([
      "completed",
      "in_progress",
      "pending",
    ]);
  });

  test("an item named by id may leave out its text", () => {
    const items = update([{ id: "1", text: "", status: "completed" }], eight());
    expect(items[0]).toMatchObject({ text: "To-do 1", status: "completed" });
  });

  test("an unknown id with no text is still refused", () => {
    expect(
      buildTaskPlan([{ id: "99", text: "" }], {
        previous: eight(),
        keepOpen: true,
      }).ok,
    ).toBe(false);
  });

  test("keeps what the update did not say, and the place in the list", () => {
    const first = buildTaskPlan([
      { text: "A", check: "node a" },
      { text: "B" },
    ]);
    if (!first.ok) throw new Error(first.error);
    const items = update([{ id: "2", status: "completed" }], first.plan);
    expect(items.map((i) => i.text)).toEqual(["A", "B"]);
    expect(items[0].check).toBe("node a");
  });

  test("a new item goes last", () => {
    const items = update([{ text: "Extra" }], eight());
    expect(items.at(-1)?.text).toBe("Extra");
    expect(items).toHaveLength(9);
  });

  test("moving on takes the old item out of progress", () => {
    const started = update([{ id: "1", status: "in_progress" }], eight());
    const plan: TaskPlan = {
      items: started,
      updatedAt: "2026-11-08T00:00:00Z",
    };
    const items = update([{ id: "2", status: "in_progress" }], plan);
    expect(items[0].status).toBe("pending");
    expect(items[1].status).toBe("in_progress");
  });

  test("planning still replaces: open items left out are removed", () => {
    const built = buildTaskPlan([{ text: "To-do 1" }], { previous: eight() });
    if (!built.ok) throw new Error(built.error);
    expect(built.plan.items).toHaveLength(1);
  });
});
