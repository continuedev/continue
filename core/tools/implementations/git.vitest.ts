import { describe, expect, it, vi } from "vitest";

import type { ToolExtras } from "../..";

import { gitToolImpl } from "./git";

function createExtras(
  subprocessImpl: (command: string, cwd?: string) => Promise<[string, string]>,
): ToolExtras {
  return {
    ide: {
      getWorkspaceDirs: vi.fn().mockResolvedValue(["file:///workspace"]),
      subprocess: vi.fn(subprocessImpl),
    } as any,
    llm: {} as any,
    fetch: (() => {
      throw new Error("unused");
    }) as any,
    tool: {} as any,
    config: {} as any,
  } as ToolExtras;
}

describe("gitToolImpl", () => {
  it("formats status output", async () => {
    const result = await gitToolImpl(
      { action: "status" },
      createExtras(async () => ["## main\n M src/index.ts\n", ""]),
    );

    expect(result[0]?.content).toBe("Git status:\n## main\n M src/index.ts");
  });

  it("formats empty diff output", async () => {
    const result = await gitToolImpl(
      { action: "diff" },
      createExtras(async () => ["", ""]),
    );

    expect(result[0]?.content).toBe("Git diff summary: no changes.");
  });

  it("rejects unsupported actions", async () => {
    await expect(
      gitToolImpl(
        { action: "commit" },
        createExtras(async () => ["", ""]),
      ),
    ).rejects.toThrow(
      "Unsupported git action: commit. Supported actions: status, diff, log, branch, remote.",
    );
  });
});
