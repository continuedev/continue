import type { TaskPlan } from "core";
import { describe, expect, it } from "vitest";
import { createMockStore, getEmptyRootState } from "../../util/test/mockStore";
import { RootState } from "../store";
import { buildPlan } from "./buildPlan";

const PLAN_URI = "file:///Users/user/workspace1/.continuous/plans/add-retry.md";

const seeded: TaskPlan = {
  items: [
    { id: "1", text: "Add a helper", status: "pending" },
    { id: "2", text: "Use it", status: "pending" },
  ],
  updatedAt: "2026-11-06T12:00:00.000Z",
  updatedBy: "model",
};

function store(fileContents: string | Error) {
  const state = getEmptyRootState();
  state.session.mode = "plan";
  state.session.taskPlan = seeded;
  state.session.planFile = PLAN_URI;
  state.config.config.selectedModelByRole.chat = {
    title: "Test model",
    model: "test-model",
    provider: "anthropic",
    underlyingProviderName: "anthropic",
  };
  const s = createMockStore(state);
  s.mockIdeMessenger.responseHandlers.readFile = async () => {
    if (fileContents instanceof Error) throw fileContents;
    return fileContents;
  };
  return s;
}

function session(s: ReturnType<typeof store>): RootState["session"] {
  return (s.getState() as RootState).session;
}

/**
 * The user message Build added to the history. (The mock messenger answers
 * no LLM requests, so the turn goes no further; what matters is what was sent.)
 */
function sentText(s: ReturnType<typeof store>): string {
  const users = session(s).history.filter(
    (item) => item.message.role === "user",
  );
  expect(users).toHaveLength(1);
  return JSON.stringify(users[0].editorState ?? users[0].message.content);
}

describe("buildPlan", () => {
  it("switches to Agent mode and sends the build message", async () => {
    const s = store(
      "# Add retry\n\n## To-dos\n\n- [ ] Add a helper <!-- id: 1 -->\n- [ ] Use it <!-- id: 2 -->\n",
    );
    await s.dispatch(buildPlan({ planFile: PLAN_URI }) as any);

    expect(session(s).mode).toBe("agent");
    const text = sentText(s);
    expect(text).toContain(".continuous/plans/add-retry.md");
    expect(text).toContain("Read the file first");
    expect(text).toContain("task list current");
    // Unchanged file: the list is the same and still the model's.
    expect(session(s).taskPlan?.items).toEqual(seeded.items);
    expect(session(s).taskPlan?.updatedBy).toBe("model");
  });

  it("takes the person's edits to the file into the task list", async () => {
    const s = store(
      "# Add retry\n\n## To-dos\n\n- [x] Add a helper <!-- id: 1 -->\n- [ ] Use it everywhere\n- [ ] Add tests\n",
    );
    await s.dispatch(buildPlan({ planFile: PLAN_URI }) as any);
    const plan = session(s).taskPlan;
    expect(plan?.updatedBy).toBe("user");
    expect(plan?.items).toEqual([
      { id: "1", text: "Add a helper", status: "completed" },
      { id: "2", text: "Use it everywhere", status: "pending" },
      { id: "3", text: "Add tests", status: "pending" },
    ]);
  });

  it("tells the model what the file's decisions say", async () => {
    const s = store(
      "# Add retry\n\n## Decisions\n\n" +
        "- Which format?\n  - options: ISO 8601 | Long\n  - pick: ISO 8601\n  - to-dos: 1\n  - answer: Long\n" +
        "- Keep the old endpoint?\n  - pick: yes\n\n" +
        "## To-dos\n\n- [ ] Add a helper <!-- id: 1 -->\n- [ ] Use it <!-- id: 2 -->\n",
    );
    await s.dispatch(buildPlan({ planFile: PLAN_URI }) as any);
    const text = sentText(s);
    expect(text).toContain("Build the plan in .continuous/plans/add-retry.md");
    expect(text).toContain("Decisions:");
    expect(text).toContain("1. Which format? (to-dos 1): decided: Long");
    expect(text).toContain(
      "2. Keep the old endpoint?: open; the person has not decided. Do not settle it.",
    );
  });

  it("sends no decision lines when the file has none", async () => {
    const s = store("# Add retry\n\n## To-dos\n\n- [ ] Add a helper\n");
    await s.dispatch(buildPlan({ planFile: PLAN_URI }) as any);
    expect(sentText(s)).not.toContain("Decisions:");
  });

  it("still builds when the file cannot be read, keeping the list", async () => {
    const s = store(new Error("gone"));
    await s.dispatch(buildPlan({ planFile: PLAN_URI }) as any);
    expect(session(s).taskPlan).toEqual(seeded);
    expect(session(s).mode).toBe("agent");
    expect(sentText(s)).toContain("Build the plan");
  });
});
