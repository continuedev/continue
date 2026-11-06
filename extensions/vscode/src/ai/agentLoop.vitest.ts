import { describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({}));

import { runAgentTurn } from "./agentLoop";

function scriptedLlm(turns: any[][]) {
  let i = 0;
  const calls: any[] = [];
  return {
    calls,
    llm: {
      streamChat: vi.fn((messages: any[]) => {
        calls.push(structuredClone(messages));
        const chunks = turns[i++] ?? [];
        return (async function* () {
          for (const c of chunks) yield c;
        })();
      }),
    } as any,
  };
}

function io(results: Record<string, string | Error> = {}) {
  const out: string[] = [];
  const progress: string[] = [];
  return {
    out,
    progress,
    io: {
      markdown: (t: string) => out.push(t),
      progress: (t: string) => progress.push(t),
      isCancelled: () => false,
      signal: new AbortController().signal,
      invokeTool: vi.fn(async (name: string) => {
        const r = results[name];
        if (r instanceof Error) throw r;
        return r ?? "ok";
      }),
    },
  };
}

describe("runAgentTurn", () => {
  it("runs the tools the model calls and feeds the results back", async () => {
    const { llm, calls } = scriptedLlm([
      [
        { role: "assistant", content: "Looking at the diff." },
        {
          role: "assistant",
          content: "",
          toolCalls: [
            { id: "t1", function: { name: "view_diff", arguments: "{}" } },
          ],
        },
      ],
      [{ role: "assistant", content: "Two files changed." }],
    ]);
    const { io: agentIo, out, progress } = io({ view_diff: "diff --git a b" });
    const shown = await runAgentTurn(
      {
        llm,
        systemMessage: "Be brief.",
        history: [],
        prompt: "What changed?",
        tools: [{ function: { name: "view_diff" } } as any],
      },
      agentIo,
    );
    expect(agentIo.invokeTool).toHaveBeenCalledWith("view_diff", {});
    expect(progress).toEqual(["Running view_diff"]);
    expect(out.join("")).toBe("Looking at the diff.\n\nTwo files changed.");
    expect(shown).toBe("Looking at the diff.\n\nTwo files changed.");
    expect(calls[0].map((m: any) => m.role)).toEqual(["system", "user"]);
    expect(calls[1].map((m: any) => m.role)).toEqual([
      "system",
      "user",
      "assistant",
      "tool",
    ]);
    expect(calls[1][3]).toEqual({
      role: "tool",
      toolCallId: "t1",
      content: "diff --git a b",
    });
  });

  it("tells the model when a tool fails or is refused", async () => {
    const { llm, calls } = scriptedLlm([
      [
        {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "t1", function: { name: "run", arguments: "{}" } }],
        },
      ],
      [{ role: "assistant", content: "Understood." }],
    ]);
    const { io: agentIo } = io({ run: new Error("The user declined") });
    await runAgentTurn({ llm, history: [], prompt: "go", tools: [] }, agentIo);
    expect(calls[1].at(-1).content).toBe("Error: The user declined");
  });

  it("stops after maxSteps", async () => {
    const looping = Array.from({ length: 5 }, () => [
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "x", function: { name: "ls", arguments: "{}" } }],
      },
    ]);
    const { llm } = scriptedLlm(looping);
    const { io: agentIo, out } = io();
    await runAgentTurn(
      { llm, history: [], prompt: "loop", tools: [], maxSteps: 2 },
      agentIo,
    );
    expect(llm.streamChat).toHaveBeenCalledTimes(2);
    expect(out.join("")).toMatch(/Stopped after 2 steps/);
  });
});
