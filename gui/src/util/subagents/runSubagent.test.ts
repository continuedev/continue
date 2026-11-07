import type {
  ChatMessage,
  ModelDescription,
  PromptLog,
  SubagentRunState,
  ToolCallState,
} from "core";
import { EXPLORE_AGENT, SubagentDefinition } from "core/subagents/definitions";
import { serializeTool } from "core/tools";
import { BuiltInToolNames } from "core/tools/builtIn";
import {
  grepSearchTool,
  readFileTool,
  runTerminalCommandTool,
} from "core/tools/definitions";
import { buildSubagentTool } from "core/tools/definitions/subagent";
import { ToCoreProtocol } from "core/protocol";
import { renderChatMessage } from "core/util/messageContent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { abortStream } from "../../redux/slices/sessionSlice";
import { RootState } from "../../redux/store";
import { createMockStore, getEmptyRootState } from "../test/mockStore";
import { answerSubagentApproval, stopSubagentRun } from "./registry";
import { runSubagentTool } from "./runSubagent";

const model: ModelDescription = {
  title: "Claude",
  model: "claude-sonnet-4-6",
  provider: "anthropic",
  underlyingProviderName: "anthropic",
};

const RUNNER: SubagentDefinition = {
  name: "runner",
  description: "Runs commands",
  prompt: "Run what you are asked to.",
  tools: ["Bash", "Read"],
  source: "workspace-claude",
};

const TOOLS = [
  serializeTool(readFileTool),
  serializeTool(grepSearchTool),
  serializeTool(runTerminalCommandTool),
  buildSubagentTool([EXPLORE_AGENT, RUNNER]),
];

function subagentCall(id: string): ToolCallState {
  const args = { agent: "Explore", prompt: "Find foo", description: "find" };
  return {
    toolCallId: id,
    status: "calling",
    parsedArgs: args,
    toolCall: {
      id,
      type: "function",
      function: {
        name: BuiltInToolNames.Subagent,
        arguments: JSON.stringify(args),
      },
    },
  };
}

function makeStore(callIds: string[], ui: Partial<RootState["ui"]> = {}) {
  const empty = getEmptyRootState();
  const calls = callIds.map(subagentCall);
  const messenger = new MockIdeMessenger();
  messenger.responses["subagents/list"] = {
    agents: [EXPLORE_AGENT, RUNNER],
    errors: [],
  };
  const store = createMockStore(
    {
      config: {
        ...empty.config,
        config: {
          ...empty.config.config,
          tools: TOOLS,
          modelsByRole: { ...empty.config.config.modelsByRole, chat: [model] },
          selectedModelByRole: {
            ...empty.config.config.selectedModelByRole,
            chat: model,
          },
        },
      },
      ui: { ...empty.ui, ...ui },
      session: {
        ...empty.session,
        isStreaming: true,
        history: [
          {
            message: { id: "u", role: "user", content: "hi" },
            contextItems: [],
          },
          {
            message: {
              id: "a",
              role: "assistant",
              content: "",
              toolCalls: calls.map((c) => c.toolCall),
            },
            contextItems: [],
            toolCallStates: calls,
          },
        ],
      },
    },
    messenger,
  );
  return { store, messenger };
}

type Turn =
  ChatMessage[] | ((signal: AbortSignal) => AsyncGenerator<ChatMessage[]>);

/** Each model call answers with the next turn; records what was sent. */
function script(messenger: MockIdeMessenger, turns: Turn[]) {
  const requests: ToCoreProtocol["llm/streamChat"][0][] = [];
  messenger.llmStreamChat = async function* (msg, signal) {
    requests.push(msg);
    const turn = turns.shift();
    if (!turn) throw new Error("no more turns");
    if (typeof turn === "function") {
      yield* turn(signal);
    } else {
      for (const chunk of turn) yield [chunk];
    }
    return undefined as PromptLog | undefined;
  };
  return requests;
}

function toolCallChunk(id: string, name: string, args: object): ChatMessage {
  return {
    role: "assistant",
    content: "",
    toolCalls: [
      {
        id,
        type: "function",
        function: { name, arguments: JSON.stringify(args) },
      },
    ],
  };
}

function runOf(store: any, id: string): SubagentRunState | undefined {
  const state = store.getState() as RootState;
  return state.session.history[1].toolCallStates?.find(
    (c) => c.toolCallId === id,
  )?.subagent;
}

async function until(check: () => boolean) {
  for (let i = 0; i < 200 && !check(); i++) {
    await new Promise((r) => setTimeout(r, 5));
  }
  expect(check()).toBe(true);
}

/** A turn that writes some text, then waits until its run is cancelled. */
function blockingTurn(text: string, started?: () => void): Turn {
  return async function* (signal) {
    started?.();
    yield [{ role: "assistant", content: text }];
    await new Promise<void>((resolve) =>
      signal.aborted
        ? resolve()
        : signal.addEventListener("abort", () => resolve(), { once: true }),
    );
  };
}

function extras(store: any, messenger: MockIdeMessenger) {
  return {
    dispatch: store.dispatch,
    getState: store.getState,
    ideMessenger: messenger,
  };
}

const args = (agent = "Explore") => ({
  agent,
  prompt: "Find foo",
  description: "find",
});

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("runSubagentTool", () => {
  it("runs a fresh conversation with the agent's tools and returns only its answer and metadata", async () => {
    const { store, messenger } = makeStore(["s1"]);
    const requests = script(messenger, [
      [toolCallChunk("c1", BuiltInToolNames.GrepSearch, { query: "foo" })],
      [{ role: "assistant", content: "foo is in a.ts:3" }],
    ]);

    const result = await runSubagentTool(
      args(),
      "s1",
      extras(store, messenger),
    );

    // Fresh context: the agent's system prompt and the prompt, nothing of
    // the parent conversation
    const first = requests[0];
    expect(first.messages[0].role).toBe("system");
    expect(first.messages[0].content).toContain("You are Explore");
    expect(first.messages).toHaveLength(2);
    expect(first.messages[1].role).toBe("user");
    expect(renderChatMessage(first.messages[1])).toBe("Find foo");
    // Explore's tools that the parent has; never the subagent tool or the
    // terminal
    expect(
      first.completionOptions.tools?.map((t) => t.function.name).sort(),
    ).toEqual([BuiltInToolNames.GrepSearch, BuiltInToolNames.ReadFile]);
    expect(first.title).toBe("Claude");
    // The subagent itself sees its tool's output
    expect(JSON.stringify(requests[1].messages)).toContain(
      "Tool call executed successfully",
    );

    expect(result.respondImmediately).toBe(true);
    const content = result.output![0].content;
    expect(content).toContain("foo is in a.ts:3");
    expect(content).toContain("status: completed");
    expect(content).toContain("- grep_search foo (done)");
    // ...but the parent does not
    expect(content).not.toContain("Tool call executed successfully");

    const run = runOf(store, "s1")!;
    expect(run.status).toBe("completed");
    expect(run.model).toBe("Claude");
    expect(run.text).toBe("foo is in a.ts:3");
    expect(run.toolCalls).toEqual([
      { name: "grep_search", summary: "foo", status: "done" },
    ]);
  });

  it("asks the person on the card when the parent's policy asks, and a rejection skips the call", async () => {
    const { store, messenger } = makeStore(["s1"], {
      toolSettings: {
        [BuiltInToolNames.RunTerminalCommand]: "allowedWithPermission",
      },
    });
    const request = vi.spyOn(messenger, "request");
    script(messenger, [
      [
        toolCallChunk("c1", BuiltInToolNames.RunTerminalCommand, {
          command: "rm -rf build",
        }),
      ],
      [{ role: "assistant", content: "Could not clean." }],
    ]);

    const done = runSubagentTool(
      args("runner"),
      "s1",
      extras(store, messenger),
    );
    await until(() => !!runOf(store, "s1")?.pendingApproval);
    const pending = runOf(store, "s1")!.pendingApproval!;
    expect(pending.toolName).toBe(BuiltInToolNames.RunTerminalCommand);
    expect(pending.summary).toBe("rm -rf build");

    expect(answerSubagentApproval(pending.id, false)).toBe(true);
    const result = await done;

    expect(
      request.mock.calls.filter(([type]) => type === "tools/call"),
    ).toHaveLength(0);
    const run = runOf(store, "s1")!;
    expect(run.pendingApproval).toBeUndefined();
    expect(run.toolCalls[0].status).toBe("canceled");
    expect(result.output![0].content).toContain(
      "- run_terminal_command rm -rf build (canceled)",
    );
  });

  it("runs an asked-about call once the person allows it", async () => {
    const { store, messenger } = makeStore(["s1"], {
      toolSettings: {
        [BuiltInToolNames.RunTerminalCommand]: "allowedWithPermission",
      },
    });
    const request = vi.spyOn(messenger, "request");
    script(messenger, [
      [
        toolCallChunk("c1", BuiltInToolNames.RunTerminalCommand, {
          command: "ls",
        }),
      ],
      [{ role: "assistant", content: "Listed." }],
    ]);
    const done = runSubagentTool(
      args("runner"),
      "s1",
      extras(store, messenger),
    );
    await until(() => !!runOf(store, "s1")?.pendingApproval);
    answerSubagentApproval(runOf(store, "s1")!.pendingApproval!.id, true);
    await done;
    expect(
      request.mock.calls.filter(([type]) => type === "tools/call"),
    ).toHaveLength(1);
    expect(runOf(store, "s1")!.toolCalls[0].status).toBe("done");
  });

  it("refuses a call the parent's policies refuse, without asking", async () => {
    const { store, messenger } = makeStore(["s1"]);
    messenger.responseHandlers["tools/evaluatePolicy"] = async () => ({
      policy: "disabled",
      reason: "deny rule",
    });
    script(messenger, [
      [
        toolCallChunk("c1", BuiltInToolNames.RunTerminalCommand, {
          command: "ls",
        }),
      ],
      [{ role: "assistant", content: "Refused." }],
    ]);
    await runSubagentTool(args("runner"), "s1", extras(store, messenger));
    const run = runOf(store, "s1")!;
    expect(run.toolCalls[0].status).toBe("errored");
    expect(run.status).toBe("completed");
  });

  it("refuses a tool the model names but the agent was not given", async () => {
    const { store, messenger } = makeStore(["s1"]);
    script(messenger, [
      [toolCallChunk("c1", BuiltInToolNames.Subagent, args())],
      [{ role: "assistant", content: "ok" }],
    ]);
    const request = vi.spyOn(messenger, "request");
    await runSubagentTool(args(), "s1", extras(store, messenger));
    expect(runOf(store, "s1")!.toolCalls[0]).toMatchObject({
      name: BuiltInToolNames.Subagent,
      status: "errored",
    });
    expect(
      request.mock.calls.filter(([type]) => type === "tools/call"),
    ).toHaveLength(0);
  });

  it("is cancelled with the parent and returns what it wrote, without continuing the parent", async () => {
    const { store, messenger } = makeStore(["s1"]);
    script(messenger, [blockingTurn("partial findings")]);
    const done = runSubagentTool(args(), "s1", extras(store, messenger));
    await until(() => runOf(store, "s1")?.text === "partial findings");

    store.dispatch(abortStream());
    const result = await done;

    expect(result.respondImmediately).toBe(false);
    const content = result.output![0].content;
    expect(content).toContain("partial findings");
    expect(content).toContain("status: cancelled");
    expect(content).toContain("reason: The parent conversation was stopped");
    expect(runOf(store, "s1")!.status).toBe("cancelled");
    const state = store.getState() as RootState;
    expect(state.session.history[1].toolCallStates![0].status).toBe("done");
  });

  it("stops one run from its card and lets the parent carry on", async () => {
    const { store, messenger } = makeStore(["s1"]);
    script(messenger, [blockingTurn("halfway")]);
    const done = runSubagentTool(args(), "s1", extras(store, messenger));
    await until(() => runOf(store, "s1")?.status === "running");

    expect(stopSubagentRun("s1")).toBe(true);
    const result = await done;
    expect(result.respondImmediately).toBe(true);
    expect(result.output![0].content).toContain("reason: Stopped by the user");
    expect(runOf(store, "s1")!.status).toBe("cancelled");
    expect(stopSubagentRun("s1")).toBe(false);
  });

  it("stops as partial at its turn limit", async () => {
    const { store, messenger } = makeStore(["s1"]);
    messenger.responses["subagents/list"] = {
      agents: [{ ...EXPLORE_AGENT, maxTurns: 1 }],
      errors: [],
    };
    script(messenger, [
      [
        { role: "assistant", content: "Looking." },
        toolCallChunk("c1", BuiltInToolNames.GrepSearch, { query: "foo" }),
      ],
    ]);
    const result = await runSubagentTool(
      args(),
      "s1",
      extras(store, messenger),
    );
    expect(runOf(store, "s1")!.status).toBe("partial");
    expect(result.output![0].content).toContain("Looking.");
    expect(result.output![0].content).toContain(
      "reason: Stopped after 1 model calls",
    );
  });

  it("fails with the reason when the agent does not exist", async () => {
    const { store, messenger } = makeStore(["s1"]);
    const result = await runSubagentTool(
      args("nobody"),
      "s1",
      extras(store, messenger),
    );
    expect(result.output![0].content).toContain("status: failed");
    expect(result.output![0].content).toContain('No subagent named "nobody"');
    expect(runOf(store, "s1")!.status).toBe("failed");
  });

  it("runs at most three at once; the rest wait as queued", async () => {
    const ids = ["s1", "s2", "s3", "s4"];
    const { store, messenger } = makeStore(ids, {
      // Caching off, so the prefix gate does not hold the siblings back
      promptCacheSettings: { Claude: "off" },
    });
    script(
      messenger,
      ids.map((id) => blockingTurn(id)),
    );
    const runs = ids.map((id) =>
      runSubagentTool(args(), id, extras(store, messenger)),
    );
    await until(
      () =>
        ids.filter((id) => runOf(store, id)?.status === "running").length === 3,
    );
    expect(runOf(store, "s4")!.status).toBe("queued");

    stopSubagentRun("s1");
    await until(() => runOf(store, "s4")?.status === "running");
    store.dispatch(abortStream());
    await Promise.all(runs);
    expect(ids.map((id) => runOf(store, id)!.status)).toEqual([
      "cancelled",
      "cancelled",
      "cancelled",
      "cancelled",
    ]);
  });

  it("with caching on, holds a sibling's first request until the first run's response starts", async () => {
    const { store, messenger } = makeStore(["s1", "s2"], {
      promptCacheSettings: { Claude: "5m" },
    });
    let releaseFirst!: () => void;
    const firstMayAnswer = new Promise<void>((r) => (releaseFirst = r));
    const requests = script(messenger, [
      async function* () {
        await firstMayAnswer;
        yield [{ role: "assistant", content: "one" }];
      },
      [{ role: "assistant", content: "two" }],
    ]);

    const first = runSubagentTool(args(), "s1", extras(store, messenger));
    await until(() => requests.length === 1);
    const second = runSubagentTool(args(), "s2", extras(store, messenger));
    await until(() => runOf(store, "s2")?.status === "running");
    await new Promise((r) => setTimeout(r, 30));
    expect(requests).toHaveLength(1);

    releaseFirst();
    await Promise.all([first, second]);
    expect(requests).toHaveLength(2);
    expect(requests[0].completionOptions.promptCaching).toBe(true);
  });
});
