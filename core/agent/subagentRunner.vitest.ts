import { expect, test, vi } from "vitest";

import {
  ChatMessage,
  ContinueConfig,
  ILLM,
  Tool,
  ToolApprovalRequest,
} from "..";
import { BuiltInToolNames } from "../tools/builtIn";
import { SUBAGENT_MAX_ITERATIONS } from "../tools/constants";
import {
  resolveSubagentModel,
  resolveSubagentTools,
  runSubagent,
} from "./subagentRunner";

function tool(name: string, readonly: boolean): Tool {
  return {
    type: "function",
    displayTitle: name,
    readonly,
    group: "Built-In",
    function: { name, description: "", parameters: { type: "object" } },
  };
}

const TOOLS: Tool[] = [
  tool(BuiltInToolNames.ReadFile, true),
  tool(BuiltInToolNames.GrepSearch, true),
  tool(BuiltInToolNames.RunTerminalCommand, false),
  tool(BuiltInToolNames.SpawnSubagents, false),
  tool(BuiltInToolNames.ShadowGetChatHistory, true),
];

function fakeConfig(overrides: Partial<ContinueConfig> = {}): ContinueConfig {
  return { tools: TOOLS, ...overrides } as ContinueConfig;
}

/** An ILLM whose every turn yields the given chunks, in order. */
function fakeLlm(turns: ChatMessage[][], providerName = "anthropic"): ILLM {
  let turnIndex = 0;
  return {
    providerName,
    model: "fake-model",
    title: "Fake",
    streamChat: async function* () {
      const chunks = turns[Math.min(turnIndex, turns.length - 1)];
      turnIndex += 1;
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  } as unknown as ILLM;
}

function baseOptions(llm: ILLM, config = fakeConfig()) {
  return {
    task: { description: "Test task", prompt: "do the thing" },
    llm,
    config,
    ide: {} as any,
    fetch: (async () => new Response("")) as any,
  };
}

test("resolveSubagentTools never includes spawn_subagents", () => {
  const names = resolveSubagentTools(fakeConfig()).map((t) => t.function.name);
  expect(names).not.toContain(BuiltInToolNames.SpawnSubagents);
});

test("resolveSubagentTools excludes spawn_subagents even when explicitly requested", () => {
  const names = resolveSubagentTools(fakeConfig(), [
    BuiltInToolNames.SpawnSubagents,
    BuiltInToolNames.ReadFile,
  ]).map((t) => t.function.name);

  expect(names).toEqual([BuiltInToolNames.ReadFile]);
});

test("resolveSubagentTools defaults to readonly tools only", () => {
  const names = resolveSubagentTools(fakeConfig()).map((t) => t.function.name);
  expect(names).toContain(BuiltInToolNames.ReadFile);
  expect(names).toContain(BuiltInToolNames.GrepSearch);
  expect(names).not.toContain(BuiltInToolNames.RunTerminalCommand);
  // A subagent has no conversation history of its own to search.
  expect(names).not.toContain(BuiltInToolNames.ShadowGetChatHistory);
});

test("resolveSubagentTools honors allowed_tools", () => {
  const names = resolveSubagentTools(fakeConfig(), [
    BuiltInToolNames.RunTerminalCommand,
  ]).map((t) => t.function.name);

  expect(names).toEqual([BuiltInToolNames.RunTerminalCommand]);
});

test("resolveSubagentModel falls back to the chat model when the name is unknown", () => {
  const fallback = fakeLlm([[]]);
  const other = { model: "cheap-model" } as ILLM;
  const config = fakeConfig({ modelsByRole: { chat: [other] } } as any);

  expect(resolveSubagentModel(config, fallback, "nope")).toBe(fallback);
  expect(resolveSubagentModel(config, fallback, undefined)).toBe(fallback);
  expect(resolveSubagentModel(config, fallback, "cheap-model")).toBe(other);
});

test("runSubagent returns the final text when the model makes no tool calls", async () => {
  const llm = fakeLlm([[{ role: "assistant", content: "the answer" }]]);
  const result = await runSubagent(baseOptions(llm));

  expect(result.status).toBe("done");
  expect(result.report).toBe("the answer");
  expect(result.iterations).toBe(1);
});

test("runSubagent stops at SUBAGENT_MAX_ITERATIONS", async () => {
  // Always asks for another tool call, so it can only end by hitting the cap.
  const llm = fakeLlm([
    [
      {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "call-1",
            index: 0,
            type: "function",
            function: { name: "nonexistent_tool", arguments: "{}" },
          },
        ],
      },
    ],
  ]);

  const result = await runSubagent(baseOptions(llm));

  expect(result.iterations).toBe(SUBAGENT_MAX_ITERATIONS);
  expect(result.report).toContain("iteration limit");
});

test("runSubagent returns canceled when the signal is already aborted", async () => {
  const controller = new AbortController();
  controller.abort();
  const llm = fakeLlm([[{ role: "assistant", content: "unreachable" }]]);

  const result = await runSubagent({
    ...baseOptions(llm),
    signal: controller.signal,
  });

  expect(result.status).toBe("canceled");
});

test("runSubagent returns canceled when the signal aborts mid-loop", async () => {
  const controller = new AbortController();
  const llm = fakeLlm([
    [
      {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "call-1",
            index: 0,
            type: "function",
            function: { name: BuiltInToolNames.ReadFile, arguments: "{}" },
          },
        ],
      },
    ],
  ]);

  const result = await runSubagent({
    ...baseOptions(llm),
    signal: controller.signal,
    // Abort while the subagent waits for approval of its first tool call.
    requestApproval: async () => {
      controller.abort();
      return { approved: false };
    },
  });

  expect(result.status).toBe("canceled");
});

test("runSubagent reports errors instead of throwing", async () => {
  const llm = {
    providerName: "anthropic",
    streamChat: async function* () {
      throw new Error("model exploded");
    },
  } as unknown as ILLM;

  const result = await runSubagent(baseOptions(llm));

  expect(result.status).toBe("errored");
  expect(result.report).toContain("model exploded");
});

test("runSubagent asks for approval before running a subagent tool call", async () => {
  const requestApproval = vi.fn(async (_params: ToolApprovalRequest) => ({
    approved: false,
  }));
  const llm = fakeLlm([
    [
      {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "call-1",
            index: 0,
            type: "function",
            function: { name: BuiltInToolNames.ReadFile, arguments: "{}" },
          },
        ],
      },
    ],
    [{ role: "assistant", content: "gave up" }],
  ]);

  await runSubagent({ ...baseOptions(llm), requestApproval });

  expect(requestApproval).toHaveBeenCalledTimes(1);
  expect(requestApproval.mock.calls[0][0]).toMatchObject({
    toolName: BuiltInToolNames.ReadFile,
    agentLabel: "Test task",
  });
});
