import type { TaskPlan } from "core";
import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { setTaskPlan } from "../../redux/slices/sessionSlice";
import { setupStore } from "../../redux/store";
import { renderWithProviders } from "../../util/test/render";
import { applyUserEdit, TaskListPanel } from "./TaskListPanel";

const plan: TaskPlan = {
  items: [
    { id: "1", text: "Write the migration", status: "completed" },
    {
      id: "2",
      text: "Run migrations",
      status: "in_progress",
      activeForm: "Running migrations",
    },
    { id: "3", text: "Deploy", status: "blocked", note: "waiting for keys" },
    { id: "4", text: "Announce", status: "pending", model: "Claude Opus" },
  ],
  updatedAt: "2026-11-06T12:00:00.000Z",
  updatedBy: "model",
};

async function setup(taskPlan: TaskPlan | null = plan) {
  const ideMessenger = new MockIdeMessenger();
  const store = setupStore({ ideMessenger });
  await renderWithProviders(<TaskListPanel />, {
    store,
    mockIdeMessenger: ideMessenger,
  });
  await act(async () => {
    store.dispatch(setTaskPlan(taskPlan ?? undefined));
  });
  return store;
}

describe("TaskListPanel", () => {
  it("renders nothing without a list", async () => {
    await setup(null);
    expect(screen.queryByTestId("task-list-panel")).toBeNull();
  });

  it("shows progress collapsed and the items when expanded", async () => {
    await setup();
    expect(screen.getByTestId("task-list-progress").textContent).toBe(
      "1/4 Running migrations",
    );
    expect(screen.queryByTestId("task-item-1")).toBeNull();
    fireEvent.click(screen.getByTestId("task-list-toggle"));
    expect(screen.getByTestId("task-item-1").dataset.status).toBe("completed");
    expect(screen.getByTestId("task-text-2").textContent).toBe(
      "Running migrations",
    );
    expect(screen.getByTestId("task-text-3").textContent).toContain(
      "waiting for keys",
    );
    // The model a loop runs the item with, where its other fields show
    expect(screen.getByTestId("task-model-4").textContent).toContain(
      "Claude Opus",
    );
    expect(screen.queryByTestId("task-model-1")).toBeNull();
  });

  it("edits an item's text in place, as the user", async () => {
    const store = await setup();
    fireEvent.click(screen.getByTestId("task-list-toggle"));
    fireEvent.click(screen.getByTestId("task-text-4"));
    const input = screen.getByTestId("task-input-4");
    fireEvent.change(input, { target: { value: "Announce in #eng" } });
    fireEvent.keyDown(input, { key: "Enter" });
    const saved = store.getState().session.taskPlan!;
    expect(saved.items.find((i) => i.id === "4")).toMatchObject({
      text: "Announce in #eng",
      // An edit keeps the item's model
      model: "Claude Opus",
    });
    expect(saved.updatedBy).toBe("user");
  });

  it("Escape cancels an edit", async () => {
    const store = await setup();
    fireEvent.click(screen.getByTestId("task-list-toggle"));
    fireEvent.click(screen.getByTestId("task-text-4"));
    const input = screen.getByTestId("task-input-4");
    fireEvent.change(input, { target: { value: "changed" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(store.getState().session.taskPlan).toEqual(plan);
  });

  it("cycles status and keeps one item in progress", async () => {
    const store = await setup();
    fireEvent.click(screen.getByTestId("task-list-toggle"));
    // pending -> in progress; the previous in-progress item goes back to pending
    fireEvent.click(screen.getByTestId("task-status-4"));
    const items = store.getState().session.taskPlan!.items;
    expect(items.find((i) => i.id === "4")?.status).toBe("in_progress");
    expect(items.find((i) => i.id === "2")?.status).toBe("pending");
  });

  it("removes, adds and clears items", async () => {
    const store = await setup();
    fireEvent.click(screen.getByTestId("task-list-toggle"));
    fireEvent.click(screen.getByTestId("task-delete-3"));
    expect(store.getState().session.taskPlan!.items.map((i) => i.id)).toEqual([
      "1",
      "2",
      "4",
    ]);

    const add = screen.getByTestId("task-list-add");
    fireEvent.change(add, { target: { value: "Write the changelog" } });
    fireEvent.keyDown(add, { key: "Enter" });
    expect(store.getState().session.taskPlan!.items.at(-1)).toMatchObject({
      id: "5",
      text: "Write the changelog",
      status: "pending",
    });

    fireEvent.click(screen.getByTestId("task-list-clear"));
    expect(store.getState().session.taskPlan).toBeUndefined();
    expect(screen.queryByTestId("task-list-panel")).toBeNull();
  });
});

describe("applyUserEdit", () => {
  it("drops completed items the person removed", () => {
    const next = applyUserEdit(
      plan,
      plan.items.filter((i) => i.id !== "1"),
    ) as TaskPlan;
    expect(next.items.map((i) => i.id)).toEqual(["2", "3", "4"]);
    expect(next.updatedBy).toBe("user");
  });

  it("reports an invalid edit instead of storing it", () => {
    expect(typeof applyUserEdit(plan, [{ text: " " }])).toBe("string");
  });
});
