import type { TaskPlan } from "core";
import { describe, expect, it, vi } from "vitest";
import { ClientToolExtras } from "./callClientTool";
import { presentPlanImpl } from "./presentPlanImpl";

const WS = "file:///work/repo";

function extras(
  session: { taskPlan?: TaskPlan; planFile?: string } = {},
  existing: string[] = [],
) {
  const dispatch = vi.fn();
  const ide = {
    getWorkspaceDirs: vi.fn().mockResolvedValue([WS]),
    fileExists: vi.fn(async (uri: string) => existing.includes(uri)),
    writeFile: vi.fn().mockResolvedValue(undefined),
  };
  return {
    dispatch,
    ide,
    extras: {
      getState: () => ({ session }),
      dispatch,
      ideMessenger: { ide },
    } as unknown as ClientToolExtras,
  };
}

const args = {
  title: "Add retry",
  plan: "Wrap upload() in a retry.",
  todos: ["Add a helper", "Use it", "Test it"],
};

describe("presentPlanImpl", () => {
  it("writes the plan file, seeds the task list and ends the turn", async () => {
    const x = extras();
    const out = await presentPlanImpl(args, "call-1", x.extras);

    const uri = `${WS}/.continue/plans/add-retry.md`;
    expect(x.ide.writeFile).toHaveBeenCalledWith(
      uri,
      expect.stringContaining("# Add retry\n\nWrap upload() in a retry."),
    );
    const written = x.ide.writeFile.mock.calls[0][1] as string;
    expect(written).toContain("- [ ] Add a helper <!-- id: 1 -->");
    expect(written).toContain("- [ ] Test it <!-- id: 3 -->");

    expect(x.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "session/setTaskPlan",
        payload: expect.objectContaining({
          items: [
            { id: "1", text: "Add a helper", status: "pending" },
            { id: "2", text: "Use it", status: "pending" },
            { id: "3", text: "Test it", status: "pending" },
          ],
        }),
      }),
    );
    expect(x.dispatch).toHaveBeenCalledWith({
      type: "session/setPlanFile",
      payload: uri,
    });

    expect(out.respondImmediately).toBe(true);
    expect(out.endTurn).toBe(true);
    expect(out.output?.[0]).toMatchObject({
      name: "Add retry",
      description: ".continue/plans/add-retry.md",
      uri: { type: "file", value: uri },
    });
    expect(out.output?.[0].content).toMatch(/Stop here and wait/);
  });

  it("replaces this session's own file but not someone else's", async () => {
    const own = `${WS}/.continue/plans/add-retry.md`;
    const mine = extras({ planFile: own }, [own]);
    await presentPlanImpl(args, "c", mine.extras);
    expect(mine.ide.writeFile.mock.calls[0][0]).toBe(own);

    const other = extras({}, [own]);
    await presentPlanImpl(args, "c", other.extras);
    expect(other.ide.writeFile.mock.calls[0][0]).toBe(
      `${WS}/.continue/plans/add-retry-2.md`,
    );
  });

  it("refuses bad arguments and writes nothing", async () => {
    const x = extras();
    await expect(
      presentPlanImpl({ title: "T", todos: [] }, "c", x.extras),
    ).rejects.toThrow(/todos/);
    expect(x.ide.writeFile).not.toHaveBeenCalled();
    expect(x.dispatch).not.toHaveBeenCalled();
  });

  it("refuses without a workspace folder", async () => {
    const x = extras();
    x.ide.getWorkspaceDirs.mockResolvedValue([]);
    await expect(presentPlanImpl(args, "c", x.extras)).rejects.toThrow(
      /No workspace folder/,
    );
    expect(x.dispatch).not.toHaveBeenCalled();
  });
});
