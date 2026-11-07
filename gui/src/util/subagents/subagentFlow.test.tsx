import { act, fireEvent, render, screen } from "@testing-library/react";
import type {
  ChatMessage,
  ModelDescription,
  PromptLog,
  Session,
  SubagentRunState,
  ToolCallState,
} from "core";
import { EXPLORE_AGENT } from "core/subagents/definitions";
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
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { useAppSelector } from "../../redux/hooks";
import { SubagentCard } from "../../pages/gui/ToolCallDiv/SubagentCard";
import sessionReducer, {
  newSession,
  setActive,
} from "../../redux/slices/sessionSlice";
import { cancelStream } from "../../redux/thunks/cancelStream";
import { streamNormalInput } from "../../redux/thunks/streamNormalInput";
import { RootState } from "../../redux/store";
import { createMockStore, getEmptyRootState } from "../test/mockStore";
import { INTERRUPTED_REASON } from "./interrupt";

/*
 * The parent's turn end to end: the parent model asks for subagents, the
 * cards show them, the person stops or approves on a card or with the main
 * Stop, and the parent continues (or does not) with the results.
 */

const model: ModelDescription = {
  title: "Claude",
  model: "claude-sonnet-4-6",
  provider: "anthropic",
  underlyingProviderName: "anthropic",
};

const grepName = BuiltInToolNames.GrepSearch;
const terminalName = BuiltInToolNames.RunTerminalCommand;

const RUNNER = {
  name: "runner",
  description: "Runs commands",
  prompt: "Run what you are asked to.",
  tools: ["Bash", "Read", "Grep"],
  source: "workspace-claude" as const,
};

type Turn = (signal: AbortSignal) => AsyncGenerator<ChatMessage[]>;
type Request = { who: string; msg: ToCoreProtocol["llm/streamChat"][0] };

interface Harness {
  store: ReturnType<typeof createMockStore>;
  messenger: MockIdeMessenger;
  requests: Request[];
  /** Parent turns in order; subagent turns keyed by their prompt. */
  parent: Turn[];
  child: Record<string, Turn[]>;
}

/** With `load`, the window opens on that saved session, as after a reload. */
function setup(ui: Partial<RootState["ui"]> = {}, load?: Session): Harness {
  const empty = getEmptyRootState();
  const fresh: RootState["session"] = {
    ...empty.session,
    mode: "agent",
    id: "session-1",
    isStreaming: true,
    history: [
      {
        message: { id: "u", role: "user", content: "hi" },
        contextItems: [],
      },
    ],
  };
  // The reducer itself, since loading aborts the store's stream aborter,
  // which the mock store's mutation check would flag
  const session = load ? sessionReducer(fresh, newSession(load)) : fresh;
  const messenger = new MockIdeMessenger();
  messenger.responses["subagents/list"] = {
    agents: [EXPLORE_AGENT, RUNNER],
    errors: [],
  };
  // The parent's request carries what it compiled: here, its messages as is
  messenger.responseHandlers["llm/compileChat"] = async ({ messages }) => ({
    compiledChatMessages: messages,
    didPrune: false,
    contextPercentage: 0.1,
  });
  const store = createMockStore(
    {
      config: {
        ...empty.config,
        config: {
          ...empty.config.config,
          tools: [
            serializeTool(readFileTool),
            serializeTool(grepSearchTool),
            serializeTool(runTerminalCommandTool),
            buildSubagentTool([EXPLORE_AGENT, RUNNER]),
          ],
          modelsByRole: { ...empty.config.config.modelsByRole, chat: [model] },
          selectedModelByRole: {
            ...empty.config.config.selectedModelByRole,
            chat: model,
          },
        },
      },
      ui: {
        ...empty.ui,
        promptCacheSettings: { Claude: "off" },
        ...ui,
      },
      session,
    },
    messenger,
  );

  const requests: Request[] = [];
  const parent: Turn[] = [];
  const child: Record<string, Turn[]> = {};
  messenger.llmStreamChat = async function* (msg, signal) {
    const system = msg.messages.find((m) => m.role === "system");
    const isChild =
      !!system && renderChatMessage(system).includes(", a subagent.");
    const who = isChild
      ? renderChatMessage(msg.messages.find((m) => m.role === "user")!)
      : "parent";
    requests.push({ who, msg });
    const turn = (isChild ? child[who] : parent)?.shift();
    if (!turn) throw new Error(`no turn scripted for ${who}`);
    yield* turn(signal);
    return undefined as PromptLog | undefined;
  };
  return { store, messenger, requests, parent, child };
}

function say(text: string): Turn {
  return async function* () {
    yield [{ role: "assistant", content: text }];
  };
}

function callTools(
  calls: { id: string; name: string; args: object }[],
  text = "",
): Turn {
  return async function* () {
    if (text) yield [{ role: "assistant", content: text }];
    yield [
      {
        role: "assistant",
        content: "",
        toolCalls: calls.map(({ id, name, args }) => ({
          id,
          type: "function" as const,
          function: { name, arguments: JSON.stringify(args) },
        })),
      },
    ];
  };
}

function subagents(...prompts: string[]): Turn {
  return callTools(
    prompts.map((prompt, i) => ({
      id: `s${i + 1}`,
      name: BuiltInToolNames.Subagent,
      args: { agent: "runner", prompt, description: prompt },
    })),
  );
}

/** Writes some text, then waits until its request is aborted. */
function block(text: string, started?: () => void): Turn {
  return async function* (signal) {
    started?.();
    yield [{ role: "assistant", content: text }];
    await aborted(signal);
  };
}

function aborted(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) =>
    signal.aborted
      ? resolve()
      : signal.addEventListener("abort", () => resolve(), { once: true }),
  );
}

function Cards() {
  const history = useAppSelector((s) => s.session.history);
  return (
    <>
      {history
        .flatMap((item) => item.toolCallStates ?? [])
        .filter((c) => c.toolCall.function.name === BuiltInToolNames.Subagent)
        .map((c) => (
          <SubagentCard key={c.toolCallId} toolCallState={c} />
        ))}
    </>
  );
}

function renderCards(store: Harness["store"]) {
  render(
    <Provider store={store as any}>
      <Cards />
    </Provider>,
  );
}

const state = (h: Harness) => h.store.getState() as RootState;

function allCalls(h: Harness): ToolCallState[] {
  return state(h).session.history.flatMap((i) => i.toolCallStates ?? []);
}

function runOf(h: Harness, id: string): SubagentRunState | undefined {
  return allCalls(h).find((c) => c.toolCallId === id)?.subagent;
}

async function until(check: () => boolean, what = "condition") {
  const deadline = Date.now() + 2000;
  while (!check() && Date.now() < deadline) {
    await act(() => new Promise((r) => setTimeout(r, 5)));
  }
  if (!check()) throw new Error(`timed out waiting for ${what}`);
}

/** Nothing is left half-way: no tool call or child call still in flight. */
function expectSettled(h: Harness) {
  for (const call of allCalls(h)) {
    expect(["done", "errored", "canceled"]).toContain(call.status);
    if (call.subagent) {
      expect(["queued", "running"]).not.toContain(call.subagent.status);
      expect(call.subagent.pendingApproval).toBeUndefined();
      for (const c of call.subagent.toolCalls) {
        expect(["calling", "generated", "generating"]).not.toContain(c.status);
      }
    }
  }
  expect(state(h).session.isStreaming).toBe(false);
}

const parentRequests = (h: Harness) =>
  h.requests.filter((r) => r.who === "parent");

/** The tool messages the parent's latest request carried, in order. */
function toolResults(h: Harness): { id: string; content: string }[] {
  const last = parentRequests(h).at(-1)!;
  return last.msg.messages
    .filter((m) => m.role === "tool")
    .map((m) => ({
      id: (m as { toolCallId: string }).toolCallId,
      content: renderChatMessage(m),
    }));
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "debug").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("Stop on a subagent card", () => {
  it("aborts its model stream; the parent gets the partial result and carries on", async () => {
    const h = setup();
    let childSignal: AbortSignal | undefined;
    h.parent.push(subagents("look"), say("parent done"));
    h.child.look = [
      async function* (signal) {
        childSignal = signal;
        yield* block("halfway")(signal);
      },
    ];
    renderCards(h.store);
    const turn = h.store.dispatch(streamNormalInput({}) as any);

    await until(() => runOf(h, "s1")?.text === "halfway", "the run to write");
    expect(screen.getByTestId("subagent-status-s1").textContent).toBe(
      "Running",
    );
    fireEvent.click(screen.getByTestId("subagent-stop-s1"));
    await turn;

    expect(childSignal!.aborted).toBe(true);
    expect(runOf(h, "s1")!.status).toBe("cancelled");
    expect(screen.getByTestId("subagent-status-s1").textContent).toBe(
      "Cancelled",
    );
    expect(screen.queryByTestId("subagent-stop-s1")).toBeNull();
    // The parent read the partial result and answered
    expect(parentRequests(h)).toHaveLength(2);
    const [result] = toolResults(h);
    expect(result.id).toBe("s1");
    expect(result.content).toContain("halfway");
    expect(result.content).toContain("reason: Stopped by the user");
    expect(state(h).session.history.at(-1)!.message.content).toBe(
      "parent done",
    );
    expectSettled(h);
  });

  it("does not wait for a tool call the subagent is running", async () => {
    const h = setup({
      toolSettings: { [terminalName]: "allowedWithoutPermission" },
    });
    h.parent.push(subagents("build"), say("parent done"));
    h.child.build = [
      callTools([{ id: "c1", name: terminalName, args: { command: "make" } }]),
    ];
    // The command never finishes on its own
    let toolStarted = false;
    h.messenger.responseHandlers["tools/call"] = () => {
      toolStarted = true;
      return new Promise(() => {});
    };
    const request = vi.spyOn(h.messenger, "request");
    renderCards(h.store);
    const turn = h.store.dispatch(streamNormalInput({}) as any);

    await until(() => toolStarted, "the command to start");
    expect(runOf(h, "s1")!.toolCalls[0]).toMatchObject({
      name: terminalName,
      status: "calling",
    });
    fireEvent.click(screen.getByTestId("subagent-stop-s1"));
    await turn;

    expect(runOf(h, "s1")!.status).toBe("cancelled");
    expect(runOf(h, "s1")!.toolCalls[0].status).toBe("canceled");
    // The running command is killed, as the parent's own Stop does
    expect(request).toHaveBeenCalledWith("process/killTerminalProcess", {
      toolCallId: "c1",
    });
    expect(parentRequests(h)).toHaveLength(2);
    expectSettled(h);
  });
});

describe("the main Stop button", () => {
  it("stops every running subagent, including one waiting for approval, and ends the turn", async () => {
    const h = setup({ toolSettings: { [grepName]: "allowedWithPermission" } });
    h.parent.push(subagents("one", "two"));
    const signals: AbortSignal[] = [];
    h.child.one = [
      async function* (signal) {
        signals.push(signal);
        yield* block("one so far")(signal);
      },
    ];
    h.child.two = [
      async function* (signal) {
        signals.push(signal);
        yield* callTools([{ id: "c1", name: grepName, args: { query: "x" } }])(
          signal,
        );
      },
    ];
    renderCards(h.store);
    const turn = h.store.dispatch(streamNormalInput({}) as any);

    await until(
      () =>
        runOf(h, "s1")?.text === "one so far" &&
        !!runOf(h, "s2")?.pendingApproval,
      "one to write and two to ask",
    );
    expect(screen.getByTestId("subagent-approval-s2")).toBeTruthy();

    await act(async () => {
      await h.store.dispatch(cancelStream() as any);
    });
    await turn;

    expect(signals.every((s) => s.aborted)).toBe(true);
    expect(runOf(h, "s1")!.status).toBe("cancelled");
    expect(runOf(h, "s2")!.status).toBe("cancelled");
    expect(runOf(h, "s2")!.toolCalls[0].status).toBe("canceled");
    expect(screen.queryByTestId("subagent-approval-s2")).toBeNull();
    // No new model call after Stop
    expect(parentRequests(h)).toHaveLength(1);
    expectSettled(h);
    for (const id of ["s1", "s2"]) {
      expect(
        allCalls(h).find((c) => c.toolCallId === id)!.output![0].content,
      ).toContain("reason: The parent conversation was stopped");
    }
  });
});

describe("parallel subagents", () => {
  it("run at once, each card shows its own progress and approval, and the parent continues once with both results in order", async () => {
    const h = setup({ toolSettings: { [grepName]: "allowedWithPermission" } });
    h.parent.push(subagents("alpha", "beta"), say("both read"));
    // The same child call id in both runs: approvals must still be told apart
    h.child.alpha = [
      callTools([{ id: "c1", name: grepName, args: { query: "alpha-q" } }]),
      say("alpha answer"),
    ];
    h.child.beta = [
      callTools([{ id: "c1", name: grepName, args: { query: "beta-q" } }]),
      say("beta answer"),
    ];
    const toolCalls: string[] = [];
    h.messenger.responseHandlers["tools/call"] = async ({ toolCall }) => {
      const { query } = JSON.parse(toolCall.function.arguments);
      toolCalls.push(query);
      return {
        contextItems: [
          { name: "r", description: "r", content: `hit ${query}` },
        ],
      };
    };
    renderCards(h.store);
    const turn = h.store.dispatch(streamNormalInput({}) as any);

    await until(
      () =>
        !!runOf(h, "s1")?.pendingApproval && !!runOf(h, "s2")?.pendingApproval,
      "both to ask",
    );
    // Both were running before either finished
    expect(runOf(h, "s1")!.status).toBe("running");
    expect(runOf(h, "s2")!.status).toBe("running");
    expect(runOf(h, "s1")!.pendingApproval!.id).not.toBe(
      runOf(h, "s2")!.pendingApproval!.id,
    );
    expect(screen.getByTestId("subagent-approval-s1").textContent).toContain(
      "alpha-q",
    );
    expect(screen.getByTestId("subagent-approval-s2").textContent).toContain(
      "beta-q",
    );
    expect(screen.getByTestId("subagent-tools-s1").textContent).not.toContain(
      "beta-q",
    );
    expect(screen.getByTestId("subagent-tools-s2").textContent).not.toContain(
      "alpha-q",
    );

    // Allowing the second card runs only the second run's call
    fireEvent.click(screen.getByTestId("subagent-accept-s2"));
    await until(() => runOf(h, "s2")?.status === "completed", "beta to finish");
    expect(toolCalls).toEqual(["beta-q"]);
    expect(runOf(h, "s1")!.pendingApproval).toBeDefined();
    expect(parentRequests(h)).toHaveLength(1);

    fireEvent.click(screen.getByTestId("subagent-accept-s1"));
    await turn;

    expect(toolCalls).toEqual(["beta-q", "alpha-q"]);
    expect(runOf(h, "s1")!.text).toBe("alpha answer");
    expect(runOf(h, "s2")!.text).toBe("beta answer");
    // One continuation, with the results in the order the parent asked
    expect(parentRequests(h)).toHaveLength(2);
    const results = toolResults(h);
    expect(results.map((r) => r.id)).toEqual(["s1", "s2"]);
    expect(results[0].content).toContain("alpha answer");
    expect(results[1].content).toContain("beta answer");
    expect(state(h).session.history.at(-1)!.message.content).toBe("both read");
    expectSettled(h);
  });

  it("continues once when both finish in the same tick", async () => {
    const h = setup();
    h.parent.push(subagents("alpha", "beta"), say("both read"));
    h.child.alpha = [say("alpha answer")];
    h.child.beta = [say("beta answer")];
    await h.store.dispatch(streamNormalInput({}) as any);

    expect(parentRequests(h)).toHaveLength(2);
    expect(toolResults(h).map((r) => r.id)).toEqual(["s1", "s2"]);
    expectSettled(h);
  });
});

describe("a session saved while its subagents ran", () => {
  /** Four parallel runs: one writing, one asking, one more writing, one queued. */
  async function startFour() {
    const h = setup({ toolSettings: { [grepName]: "allowedWithPermission" } });
    h.parent.push(subagents("one", "two", "three", "four"));
    h.child.one = [block("one so far")];
    h.child.two = [
      callTools([{ id: "c1", name: grepName, args: { query: "x" } }], "two"),
    ];
    h.child.three = [block("three so far")];
    h.child.four = [block("four so far")];
    renderCards(h.store);
    const turn = h.store.dispatch(streamNormalInput({}) as any);
    await until(
      () =>
        runOf(h, "s1")?.text === "one so far" &&
        !!runOf(h, "s2")?.pendingApproval &&
        runOf(h, "s3")?.text === "three so far" &&
        runOf(h, "s4")?.status === "queued",
      "three to run and the fourth to queue",
    );
    const saved: Session = {
      sessionId: "session-1",
      title: "t",
      workspaceDirectory: "",
      history: structuredClone(state(h).session.history),
    };
    return { h, turn, saved };
  }

  function expectInterrupted(calls: ToolCallState[]) {
    const ids = ["s1", "s2", "s3", "s4"];
    for (const id of ids) {
      const call = calls.find((c) => c.toolCallId === id)!;
      expect(call.status).toBe("done");
      expect(call.subagent!.status).toBe("interrupted");
      expect(call.subagent!.error).toBe(INTERRUPTED_REASON);
      expect(call.subagent!.pendingApproval).toBeUndefined();
      expect(
        call.subagent!.toolCalls.every((c) => c.status !== "calling"),
      ).toBe(true);
      expect(call.output![0].content).toContain("status: interrupted");
    }
    const byId = (id: string) => calls.find((c) => c.toolCallId === id)!;
    expect(byId("s1").output![0].content).toContain("one so far");
    expect(byId("s2").subagent!.toolCalls[0].status).toBe("canceled");
  }

  it("comes back after a reload with every run interrupted, and the parent can carry on", async () => {
    const { h, turn, saved } = await startFour();
    // The old window goes away
    await act(async () => {
      await h.store.dispatch(cancelStream() as any);
    });
    await turn;

    const reloaded = setup({}, saved);
    expectInterrupted(allCalls(reloaded));

    reloaded.parent.push(say("carrying on"));
    reloaded.store.dispatch(setActive());
    await reloaded.store.dispatch(streamNormalInput({}) as any);
    expect(toolResults(reloaded).map((r) => r.id)).toEqual([
      "s1",
      "s2",
      "s3",
      "s4",
    ]);
    expect(
      toolResults(reloaded).every((r) =>
        r.content.includes("status: interrupted"),
      ),
    ).toBe(true);
    expectSettled(reloaded);
  });

  it("stays interrupted when reopened in the same window while the runs wind down", async () => {
    const { h, turn, saved } = await startFour();
    await act(async () => {
      h.store.dispatch(newSession(saved));
    });
    await turn;
    await act(() => new Promise((r) => setTimeout(r, 20)));

    expectInterrupted(allCalls(h));
    expect(screen.getByTestId("subagent-status-s1").textContent).toBe(
      "Interrupted",
    );
  });
});

describe("prompt-cache stagger between siblings", () => {
  const cached = { promptCacheSettings: { Claude: "5m" as const } };
  const childRequests = (h: Harness) =>
    h.requests.filter((r) => r.who !== "parent").map((r) => r.who);

  it("holds the second request until the first starts answering", async () => {
    const h = setup(cached);
    let answer!: () => void;
    const mayAnswer = new Promise<void>((r) => (answer = r));
    h.parent.push(subagents("alpha", "beta"), say("ok"));
    h.child.alpha = [
      async function* () {
        await mayAnswer;
        yield [{ role: "assistant", content: "alpha answer" }];
      },
    ];
    h.child.beta = [say("beta answer")];
    const turn = h.store.dispatch(streamNormalInput({}) as any);

    await until(() => runOf(h, "s2")?.status === "running", "beta to start");
    await new Promise((r) => setTimeout(r, 30));
    expect(childRequests(h)).toEqual(["alpha"]);

    answer();
    await turn;
    expect(childRequests(h)).toEqual(["alpha", "beta"]);
    expectSettled(h);
  });

  it("releases the second when the first request fails", async () => {
    const h = setup(cached);
    let fail!: () => void;
    const failed = new Promise<void>((r) => (fail = r));
    h.parent.push(subagents("alpha", "beta"), say("ok"));
    h.child.alpha = [
      async function* () {
        await failed;
        throw new Error("overloaded");
      },
    ];
    h.child.beta = [say("beta answer")];
    const turn = h.store.dispatch(streamNormalInput({}) as any);

    await until(() => runOf(h, "s2")?.status === "running", "beta to start");
    expect(childRequests(h)).toEqual(["alpha"]);
    fail();
    await turn;

    expect(runOf(h, "s1")!.status).toBe("failed");
    expect(runOf(h, "s2")!.status).toBe("completed");
    expect(childRequests(h)).toEqual(["alpha", "beta"]);
    expectSettled(h);
  });

  it("releases the second when the first is stopped before it answers", async () => {
    const h = setup(cached);
    h.parent.push(subagents("alpha", "beta"), say("ok"));
    h.child.alpha = [
      async function* (signal) {
        await aborted(signal);
      },
    ];
    h.child.beta = [say("beta answer")];
    renderCards(h.store);
    const turn = h.store.dispatch(streamNormalInput({}) as any);

    await until(() => runOf(h, "s2")?.status === "running", "beta to start");
    expect(childRequests(h)).toEqual(["alpha"]);
    fireEvent.click(screen.getByTestId("subagent-stop-s1"));
    await turn;

    expect(runOf(h, "s1")!.status).toBe("cancelled");
    expect(runOf(h, "s2")!.status).toBe("completed");
    expect(childRequests(h)).toEqual(["alpha", "beta"]);
    expectSettled(h);
  });

  it("sends no request for a sibling stopped while it waits", async () => {
    const h = setup(cached);
    let answer!: () => void;
    const mayAnswer = new Promise<void>((r) => (answer = r));
    h.parent.push(subagents("alpha", "beta"), say("ok"));
    h.child.alpha = [
      async function* () {
        await mayAnswer;
        yield [{ role: "assistant", content: "alpha answer" }];
      },
    ];
    h.child.beta = [say("beta answer")];
    renderCards(h.store);
    const turn = h.store.dispatch(streamNormalInput({}) as any);

    await until(() => runOf(h, "s2")?.status === "running", "beta to start");
    fireEvent.click(screen.getByTestId("subagent-stop-s2"));
    await until(() => runOf(h, "s2")?.status === "cancelled", "beta to stop");
    answer();
    await turn;

    expect(childRequests(h)).toEqual(["alpha"]);
    expect(runOf(h, "s1")!.status).toBe("completed");
    expectSettled(h);
  });
});
