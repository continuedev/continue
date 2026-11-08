import { Problem } from "core";
import { describe, expect, it, vi } from "vitest";

import { IIdeMessenger } from "../context/IdeMessenger";
import {
  problemsAfterEdit,
  rememberProblemsBeforeEdit,
} from "./problemsAfterEdit";

const problem = (message: string, line: number): Problem => ({
  filepath: "file:///w/a.ts",
  range: { start: { line, character: 0 }, end: { line, character: 1 } },
  message,
  severity: "error",
});

function messenger(before: Problem[], after: Problem[]) {
  const request = vi.fn(async (type: string) => ({
    status: "success" as const,
    done: true as const,
    content: type === "getProblems" ? before : after,
  }));
  const ide = { getWorkspaceDirs: vi.fn(async () => ["file:///w"]) };
  return { request, ide } as unknown as IIdeMessenger & {
    request: typeof request;
  };
}

describe("problems after an edit", () => {
  it("reports what the edit added, after waiting for the language servers", async () => {
    const ide = messenger(
      [problem("old", 2)],
      [problem("old", 5), problem("new", 3)],
    );
    rememberProblemsBeforeEdit(ide, "call-1", "file:///w/a.ts");
    const item = await problemsAfterEdit(ide, "call-1", "file:///w/a.ts");

    expect(ide.request).toHaveBeenCalledWith("getProblems", {
      filepath: "file:///w/a.ts",
    });
    expect(ide.request).toHaveBeenCalledWith("waitForProblems", {
      filepath: "file:///w/a.ts",
      timeoutMs: 1500,
    });
    expect(item?.content).toContain("1 new problem in a.ts");
    expect(item?.content).toContain("line 4: error: new");
    expect(item?.content).not.toContain(": old");
  });

  it("adds nothing when the edit added no problems", async () => {
    const ide = messenger([problem("old", 2)], [problem("old", 2)]);
    rememberProblemsBeforeEdit(ide, "call-2", "file:///w/a.ts");
    expect(
      await problemsAfterEdit(ide, "call-2", "file:///w/a.ts"),
    ).toBeUndefined();
  });

  it("does nothing for an edit it did not see start", async () => {
    const ide = messenger([], [problem("new", 1)]);
    expect(
      await problemsAfterEdit(ide, "unknown", "file:///w/a.ts"),
    ).toBeUndefined();
    expect(ide.request).not.toHaveBeenCalled();
  });

  it("does not fail the edit when the IDE cannot answer", async () => {
    const ide = {
      request: vi.fn(async () => {
        throw new Error("no IDE");
      }),
    } as unknown as IIdeMessenger;
    rememberProblemsBeforeEdit(ide, "call-3", "file:///w/a.ts");
    expect(
      await problemsAfterEdit(ide, "call-3", "file:///w/a.ts"),
    ).toBeUndefined();
  });
});
