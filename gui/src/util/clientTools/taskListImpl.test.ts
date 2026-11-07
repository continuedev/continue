import type { TaskPlan } from "core";
import { describe, expect, it, vi } from "vitest";
import { ClientToolExtras } from "./callClientTool";
import { taskListImpl } from "./taskListImpl";

function extras(taskPlan?: TaskPlan) {
  const dispatch = vi.fn();
  return {
    dispatch,
    extras: {
      getState: () => ({ session: { taskPlan } }),
      dispatch,
      ideMessenger: {},
    } as unknown as ClientToolExtras,
  };
}

describe("taskListImpl", () => {
  it("stores the list and answers with a confirmation, not the list", async () => {
    const { dispatch, extras: x } = extras();
    const out = await taskListImpl(
      {
        items: [
          { text: "Read", status: "completed" },
          { text: "Fix", status: "in_progress", activeForm: "Fixing" },
          { text: "Test" },
        ],
      },
      "call-1",
      x,
    );
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "session/setTaskPlan",
        payload: expect.objectContaining({
          updatedBy: "model",
          items: [
            { id: "1", text: "Read", status: "completed" },
            {
              id: "2",
              text: "Fix",
              status: "in_progress",
              activeForm: "Fixing",
            },
            { id: "3", text: "Test", status: "pending" },
          ],
        }),
      }),
    );
    expect(out.respondImmediately).toBe(true);
    const text = out.output?.[0].content ?? "";
    expect(text).toContain("1/3 done");
    expect(text).not.toContain("Test");
  });

  it("accepts the items as a JSON string", async () => {
    const { dispatch, extras: x } = extras();
    await taskListImpl(
      { items: JSON.stringify([{ text: "One", status: "pending" }]) },
      "call-1",
      x,
    );
    expect(dispatch.mock.calls[0][0].payload.items).toHaveLength(1);
  });

  it("rejects two items in progress", async () => {
    const { dispatch, extras: x } = extras();
    await expect(
      taskListImpl(
        {
          items: [
            { text: "a", status: "in_progress" },
            { text: "b", status: "in_progress" },
          ],
        },
        "call-1",
        x,
      ),
    ).rejects.toThrow(/at most one/);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("keeps completed items the update leaves out", async () => {
    const { dispatch, extras: x } = extras({
      items: [
        { id: "1", text: "Done", status: "completed" },
        { id: "2", text: "Next", status: "pending" },
      ],
      updatedAt: "",
    });
    await taskListImpl(
      { items: [{ id: "2", text: "Next", status: "in_progress" }] },
      "call-1",
      x,
    );
    expect(
      dispatch.mock.calls[0][0].payload.items.map((i: any) => i.id),
    ).toEqual(["1", "2"]);
  });
});
