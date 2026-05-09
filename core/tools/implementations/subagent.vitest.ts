import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ToolExtras } from "../..";
import { subagentToolImpl } from "./subagent";

const { mockRunAgent } = vi.hoisted(() => ({
  mockRunAgent: vi.fn(),
}));

vi.mock("../../agent/AgentRunner", () => ({
  runAgent: mockRunAgent,
}));

vi.mock("../../util/paths", () => ({
  getContinueGlobalPath: () => process.env.YUTOAGENTIC_GLOBAL_DIR ?? "",
}));

describe("subagentToolImpl", () => {
  let globalDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    globalDir = await fs.mkdtemp(path.join(os.tmpdir(), "yuto-core-subagent-"));
    process.env.YUTOAGENTIC_GLOBAL_DIR = globalDir;
  });

  afterEach(async () => {
    delete process.env.YUTOAGENTIC_GLOBAL_DIR;
    await fs.rm(globalDir, { recursive: true, force: true });
  });

  function createExtras(): ToolExtras {
    return {
      ide: {} as any,
      llm: {} as any,
      fetch: vi.fn() as any,
      tool: {} as any,
      toolCallId: "tool-call-id",
      config: {
        tools: [],
        selectedModelByRole: {
          subagent: {
            title: "Coordinator Worker",
            model: "coord-worker",
            toolOverrides: [],
            baseAgentSystemMessage: "Base system message",
          },
        },
        modelsByRole: {
          subagent: [
            {
              title: "Coordinator Worker",
              model: "coord-worker",
              toolOverrides: [],
              baseAgentSystemMessage: "Base system message",
            },
          ],
        },
      } as any,
      _agentSessionId: "parent-session",
    } as ToolExtras & { _agentSessionId: string };
  }

  it("threads coordinator scratchpad context into the child system message and appends the result", async () => {
    mockRunAgent.mockResolvedValue({
      messages: [{ role: "assistant", content: "Worker summary" }],
      stopReason: "done",
      totalTurns: 2,
    });

    const extras = createExtras();

    const result = await subagentToolImpl(
      {
        prompt: "Inspect the failing tool path",
        subagent_name: "Coordinator Worker",
        profile: "coordinator-worker",
      },
      extras,
    );

    const scratchpadPath = path.join(
      globalDir,
      "coordinator",
      "parent-session",
      "WORKER_SCRATCHPAD.md",
    );
    const scratchpad = await fs.readFile(scratchpadPath, "utf8");

    expect(mockRunAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        systemMessage: expect.stringContaining(
          `Shared scratchpad path: ${scratchpadPath}`,
        ),
      }),
    );
    expect(result[0]?.content).toContain("Worker summary");
    expect(scratchpad).toContain("Inspect the failing tool path");
    expect(scratchpad).toContain("Worker summary");
  });

  it("records failures in the coordinator scratchpad before rethrowing", async () => {
    mockRunAgent.mockRejectedValue(new Error("subagent failed"));

    const extras = createExtras();
    const scratchpadPath = path.join(
      globalDir,
      "coordinator",
      "parent-session",
      "WORKER_SCRATCHPAD.md",
    );

    await expect(
      subagentToolImpl(
        {
          prompt: "Reproduce the failure",
          subagent_name: "Coordinator Worker",
          profile: "coordinator-worker",
        },
        extras,
      ),
    ).rejects.toThrow("subagent failed");

    const scratchpad = await fs.readFile(scratchpadPath, "utf8");
    expect(scratchpad).toContain("Status: failed");
    expect(scratchpad).toContain("subagent failed");
  });

  it("records aborted coordinator workers as cancelled", async () => {
    mockRunAgent.mockResolvedValue({
      messages: [],
      stopReason: "aborted",
      totalTurns: 1,
    });

    const extras = createExtras();
    const scratchpadPath = path.join(
      globalDir,
      "coordinator",
      "parent-session",
      "WORKER_SCRATCHPAD.md",
    );

    const result = await subagentToolImpl(
      {
        prompt: "Start the fix and stop midway",
        subagent_name: "Coordinator Worker",
        profile: "coordinator-worker",
      },
      extras,
    );

    const scratchpad = await fs.readFile(scratchpadPath, "utf8");
    expect(result[0]?.description).toContain("stopReason=aborted");
    expect(result[0]?.content).toContain(
      "Subagent was cancelled before producing a final response.",
    );
    expect(scratchpad).toContain("Status: cancelled");
  });
});
