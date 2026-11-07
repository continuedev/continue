import type { TaskPlan } from "core/index.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ plan: undefined as TaskPlan | undefined }));
vi.mock("../session.js", () => ({
  getSessionTaskPlan: () => store.plan,
  updateSessionTaskPlan: (plan: TaskPlan | undefined) => {
    store.plan = plan;
  },
}));

import { taskListTool } from "./taskList.js";
import { writeChecklistTool } from "./writeChecklist.js";

beforeEach(() => {
  store.plan = undefined;
});

describe("TaskList", () => {
  it("stores the list on the session and returns a short confirmation", async () => {
    const result = await taskListTool.run({
      items: [
        { text: "Read", status: "completed" },
        { text: "Fix", status: "in_progress", activeForm: "Fixing" },
        { text: "Test", status: "pending" },
      ],
    });
    expect(store.plan?.items.map((i) => [i.id, i.status])).toEqual([
      ["1", "completed"],
      ["2", "in_progress"],
      ["3", "pending"],
    ]);
    expect(result).toContain("1/3 done");
    expect(result).toContain("In progress: 2. Fix");
    expect(result).not.toContain("Test");
  });

  it("rejects two items in progress without storing anything", async () => {
    await expect(
      taskListTool.run({
        items: [
          { text: "a", status: "in_progress" },
          { text: "b", status: "in_progress" },
        ],
      }),
    ).rejects.toThrow(/at most one/);
    expect(store.plan).toBeUndefined();
  });

  it("previews the list it would store as a checklist", async () => {
    const preprocessed = await taskListTool.preprocess!({
      items: JSON.stringify([{ text: "One", status: "in_progress" }]),
    });
    expect(preprocessed.preview).toEqual([
      { type: "checklist", content: "- [>] One" },
    ]);
    expect(store.plan).toBeUndefined();
  });

  it("is read-only and built in", () => {
    expect(taskListTool.name).toBe("TaskList");
    expect(taskListTool.readonly).toBe(true);
    expect(taskListTool.isBuiltIn).toBe(true);
    expect(taskListTool.parameters.required).toEqual(["items"]);
  });
});

describe("Checklist (alias of TaskList)", () => {
  it("maps the markdown checkboxes onto the task list", async () => {
    const result = await writeChecklistTool.run({
      checklist: "- [x] Task 1\n- [>] Task 2\n- [ ] Task 3\n- [!] Task 4",
    });
    expect(store.plan?.items).toEqual([
      { id: "1", text: "Task 1", status: "completed" },
      { id: "2", text: "Task 2", status: "in_progress" },
      { id: "3", text: "Task 3", status: "pending" },
      { id: "4", text: "Task 4", status: "blocked" },
    ]);
    expect(result).toContain("1/4 done");
    expect(result).not.toContain("Task list status:");
  });

  it("keeps ids by matching text with the current list", async () => {
    await taskListTool.run({
      items: [
        { text: "Write the migration", status: "in_progress" },
        { text: "Run it", status: "pending" },
      ],
    });
    await writeChecklistTool.run({
      checklist: "- [ ] Run it\n- [x] Write the migration\n- [ ] Deploy",
    });
    expect(store.plan?.items.map((i) => [i.id, i.text, i.status])).toEqual([
      ["2", "Run it", "pending"],
      ["1", "Write the migration", "completed"],
      ["3", "Deploy", "pending"],
    ]);
  });

  it("keeps its name and markdown parameter", () => {
    expect(writeChecklistTool.name).toBe("Checklist");
    expect(writeChecklistTool.isBuiltIn).toBe(true);
    expect(writeChecklistTool.parameters.required?.includes("checklist")).toBe(
      true,
    );
  });
});
