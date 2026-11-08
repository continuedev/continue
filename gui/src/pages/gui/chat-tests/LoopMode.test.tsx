import { act, fireEvent, waitFor } from "@testing-library/react";
import type { ChatMessage, PromptLog } from "core";
import { serializeTool } from "core/tools";
import { BuiltInToolNames } from "core/tools/builtIn";
import {
  createNewFileTool,
  finishItemTool,
  holdQuestionTool,
  presentPlanTool,
  readFileTool,
  runTerminalCommandTool,
  taskListTool,
} from "core/tools/definitions";
import { renderChatMessage } from "core/util/messageContent";
import { serializePlanFile } from "core/util/planFile";
import { selectActiveTools } from "../../../redux/selectors/selectActiveTools";
import { setLoop, setPlanFile } from "../../../redux/slices/sessionSlice";
import { setApprovalMode } from "../../../redux/slices/uiSlice";
import { startLoopFromPlan } from "../../../redux/thunks/loop";
import { triggerConfigUpdate } from "../../../util/test/config";
import { renderWithProviders } from "../../../util/test/render";
import { Chat } from "../Chat";

/*
 * Loop mode end to end in the chat: the loop seeds its items from a plan
 * file, runs each with the one-item prompt, holds questions in the inbox
 * while other items run, routes the person's answers, holds tool calls that
 * would ask, and re-plans in Plan mode when a round runs dry.
 */

const WORKSPACE = "file:///Users/user/workspace1";
const PLAN_FILE = `${WORKSPACE}/.continuous/plans/build-the-parser.md`;

type Turn = (signal: AbortSignal) => AsyncGenerator<ChatMessage[]>;

function calls(...list: { name: string; args: object }[]): Turn {
  return async function* () {
    yield [
      {
        role: "assistant",
        content: "",
        toolCalls: list.map(({ name, args }, i) => ({
          id: `call-${Math.random().toString(36).slice(2)}-${i}`,
          type: "function" as const,
          function: { name, arguments: JSON.stringify(args) },
        })),
      },
    ];
  };
}

const finish = (
  outcome: "done" | "waiting" | "stuck",
  summary: string = outcome,
) => calls({ name: BuiltInToolNames.FinishItem, args: { outcome, summary } });

const ask = (
  question: string,
  kind: "blocking" | "assumption",
  assumption?: string,
) =>
  calls({
    name: BuiltInToolNames.HoldQuestion,
    args: { question, kind, ...(assumption ? { assumption } : {}) },
  });

const text = (m: ChatMessage | undefined) => (m ? renderChatMessage(m) : "");

async function setup(todos: string[]) {
  const rendered = await renderWithProviders(<Chat />);
  const { store, ideMessenger } = rendered;
  await act(async () => {
    triggerConfigUpdate({
      store,
      ideMessenger,
      editConfig(current) {
        const llm = {
          model: "mock",
          provider: "mock",
          title: "Mock LLM",
          underlyingProviderName: "mock",
        };
        current.modelsByRole.chat.push(llm);
        current.selectedModelByRole.chat = llm;
        current.tools = [
          readFileTool,
          runTerminalCommandTool,
          createNewFileTool,
          taskListTool,
          presentPlanTool,
          holdQuestionTool,
          finishItemTool,
        ].map(serializeTool) as any;
        return current;
      },
    });
  });

  // An in-memory workspace for the plan file
  const files: Record<string, string> = {
    [PLAN_FILE]: serializePlanFile({
      title: "Build the parser",
      body: "Parse the grammar.",
      items: todos.map((t, i) => ({
        id: String(i + 1),
        text: t,
        status: "pending" as const,
      })),
    }),
  };
  const path = (data: any) => data.filepath ?? data.fileUri ?? data.path;
  ideMessenger.responseHandlers["readFile"] = async (data: any) =>
    files[path(data)] ?? "";
  ideMessenger.responseHandlers["writeFile"] = async (data: any) => {
    files[path(data)] = data.contents;
  };
  ideMessenger.responseHandlers["fileExists"] = async (data: any) =>
    path(data) in files;
  ideMessenger.responses["context/getSymbolsForFiles"] = {};
  ideMessenger.responseHandlers["llm/compileChat"] = async ({
    messages,
  }: any) => ({
    compiledChatMessages: messages,
    didPrune: false,
    contextPercentage: 0.1,
  });

  // The model: scripted turns in order; every request is recorded
  const turns: Turn[] = [];
  const requests: { messages: ChatMessage[]; tools: string[] }[] = [];
  ideMessenger.llmStreamChat = async function* (msg: any, signal) {
    requests.push({
      messages: msg.messages,
      // What the gui offered with this request
      tools: selectActiveTools(store.getState()).map((t) => t.function.name),
    });
    const turn = turns.shift();
    if (!turn) throw new Error("no turn scripted");
    yield* turn(signal);
    return undefined as PromptLog | undefined;
  };

  const start = async () => {
    await act(async () => {
      store.dispatch(setPlanFile(PLAN_FILE));
      await store.dispatch(startLoopFromPlan({ planFile: PLAN_FILE }));
    });
  };
  /** The prompt the loop sent with request n (the last user message before the task list block). */
  const prompt = (n: number) =>
    text(
      requests[n]?.messages
        .filter((m) => m.role === "user" && !text(m).startsWith("<task_list>"))
        .at(-1),
    );
  const loop = () => store.getState().session.loop!;
  const itemStatus = (id: string) =>
    loop().items.find((i) => i.id === id)?.status;
  return {
    ...rendered,
    files,
    turns,
    requests,
    start,
    prompt,
    loop,
    itemStatus,
  };
}

function answerInInbox(questionId: string, answer: string) {
  const row = document.querySelector(
    `[data-testid=loop-question-${questionId}]`,
  )!;
  const input = row.querySelector<HTMLInputElement>(
    "[data-testid=loop-answer-input]",
  )!;
  fireEvent.change(input, { target: { value: answer } });
  fireEvent.click(row.querySelector("[data-testid=loop-answer-send]")!);
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "debug").mockImplementation(() => {});
});

describe("Loop mode", () => {
  test("seeds the items, parks a blocking question while the others run, and requeues it when answered", async () => {
    const h = await setup(["Pick the grammar", "Write the lexer", "Add tests"]);
    h.turns.push(
      // Item 1 asks a blocking question and reports waiting
      ask("Item 'Pick the grammar': ABNF or PEG? No default fits.", "blocking"),
      finish("waiting", "needs the grammar choice"),
      // Items 2 and 3 run meanwhile
      finish("done", "lexer written"),
      finish("done", "tests added"),
      // Item 1 again, with the answer
      finish("done", "grammar picked"),
    );
    await h.start();

    expect(h.loop().items.map((i) => i.id)).toEqual(["1", "2", "3"]);
    await waitFor(() => expect(h.loop().status).toBe("waiting"));
    expect(h.itemStatus("1")).toBe("waiting");
    expect(h.itemStatus("2")).toBe("done");
    expect(h.itemStatus("3")).toBe("done");
    expect(h.prompt(0)).toContain("only this item: Pick the grammar");
    expect(h.prompt(0)).toContain(".continuous/plans/build-the-parser.md");
    expect(h.prompt(2)).toContain("only this item: Write the lexer");
    // The loop's tools are offered; the task list is the loop's
    expect(h.requests[0].tools).toContain(BuiltInToolNames.HoldQuestion);
    expect(h.requests[0].tools).not.toContain(BuiltInToolNames.TaskList);
    // The task list shows where each item is
    expect(
      h.store.getState().session.taskPlan!.items.map((i) => i.status),
    ).toEqual(["blocked", "completed", "completed"]);

    expect(
      document.querySelector("[data-testid=loop-status]")!.textContent,
    ).toContain("paused until you answer");
    await act(async () => answerInInbox("q1", "PEG"));

    await waitFor(() => expect(h.loop().status).toBe("stopped"));
    expect(h.loop().stopReason).toBe("done");
    expect(h.prompt(4)).toContain("only this item: Pick the grammar");
    expect(h.prompt(4)).toContain(": PEG");
    expect(h.loop().answers[0]).toMatchObject({
      route: "requeue",
      delivered: true,
    });
    // Off again once the loop is done
    expect(
      selectActiveTools(h.store.getState()).map((t) => t.function.name),
    ).not.toContain(BuiltInToolNames.FinishItem);
  });

  test("an answer given while its item runs is steered in at the next tool boundary", async () => {
    const h = await setup(["Write the lexer"]);
    let release = () => {};
    let readStarted = () => {};
    const reading = new Promise<void>((r) => (readStarted = r));
    h.ideMessenger.responseHandlers["tools/call"] = async () => {
      readStarted();
      await new Promise<void>((r) => (release = r));
      return {
        contextItems: [{ name: "a.ts", description: "a.ts", content: "src" }],
      };
    };
    h.turns.push(
      ask(
        "Item 'Write the lexer': name it lexer.ts?",
        "assumption",
        "lexer.ts",
      ),
      calls({ name: BuiltInToolNames.ReadFile, args: { filepath: "a.ts" } }),
      finish("done", "lexer.ts written"),
    );
    await h.start();
    await reading;
    expect(h.itemStatus("1")).toBe("running");

    await act(async () => answerInInbox("q1", "Call it tokens.ts"));
    expect(h.loop().answers[0].route).toBe("steer");
    expect(h.store.getState().session.queuedMessages[0]).toMatchObject({
      steer: true,
      loopAnswerId: "a1",
    });

    await act(async () => release());
    await waitFor(() => expect(h.loop().status).toBe("stopped"));
    // The request after the read carries the answer, in the same run
    expect(h.prompt(2)).toContain("Call it tokens.ts");
    expect(h.loop().answers[0].delivered).toBe(true);
    expect(h.store.getState().session.queuedMessages).toEqual([]);
    expect(h.requests).toHaveLength(3);
  });

  test("a round that runs dry is re-planned in Plan mode, and accepting the card starts the next round", async () => {
    const h = await setup(["Write the lexer", "Add tests"]);
    h.turns.push(
      finish("done", "lexer written"),
      finish("stuck", "no test runner installed"),
      // The re-plan: a read-only turn that presents the updated plan
      calls({
        name: BuiltInToolNames.PresentPlan,
        args: {
          title: "Build the parser",
          plan: "Parse the grammar.",
          todos: ["Write the lexer", "Install vitest", "Add tests"],
        },
      }),
      finish("done", "vitest installed"),
      finish("done", "tests added"),
    );
    await h.start();

    await waitFor(() => expect(h.loop().status).toBe("awaiting_plan"));
    expect(h.store.getState().session.mode).toBe("plan");
    expect(h.prompt(2)).toContain("Re-evaluate the plan");
    expect(h.prompt(2)).toContain("(failed: no test runner installed)");
    expect(h.prompt(2)).toContain('title "Build the parser"');
    // Plan mode's turn has no loop tools and cannot write
    expect(h.requests[2].tools).not.toContain(BuiltInToolNames.FinishItem);
    expect(h.requests[2].tools).not.toContain(
      BuiltInToolNames.RunTerminalCommand,
    );

    const cont = await waitFor(() => {
      const el = document.querySelector<HTMLElement>(
        "[data-testid=plan-card-loop-continue]",
      );
      expect(el).not.toBeNull();
      return el!;
    });
    await act(async () => cont.click());

    await waitFor(() => expect(h.loop().status).toBe("stopped"));
    expect(h.loop().stopReason).toBe("done");
    expect(h.loop().round).toBe(2);
    // The finished item kept its id and stayed done; only the rest ran
    expect(h.prompt(3)).toContain("only this item: Install vitest");
    expect(h.prompt(4)).toContain("only this item: Add tests");
    expect(h.requests).toHaveLength(5);
  });

  test("a call that would ask is held as an approval question, and runs once allowed", async () => {
    const h = await setup(["Run the build"]);
    let ran = 0;
    h.ideMessenger.responseHandlers["tools/call"] = async () => {
      ran++;
      return {
        contextItems: [{ name: "out", description: "out", content: "ok" }],
      };
    };
    const build = calls({
      name: BuiltInToolNames.RunTerminalCommand,
      args: { command: "npm run build", waitForCompletion: true },
    });
    h.turns.push(
      build,
      finish("waiting", "needs approval for the build"),
      build,
      finish("done", "built"),
    );
    await h.start();

    await waitFor(() => expect(h.loop().status).toBe("waiting"));
    expect(ran).toBe(0);
    expect(h.loop().questions[0]).toMatchObject({ kind: "approval" });
    // The inbox says what would run, so it can be answered from there
    expect(h.loop().questions[0].question).toContain("npm run build");
    expect(h.requests[1].messages.map(text).join(" ")).toContain(
      "needs the person's approval",
    );

    await act(async () => {
      fireEvent.click(document.querySelector("[data-testid=loop-approve]")!);
    });
    await waitFor(() => expect(h.loop().status).toBe("stopped"));
    expect(h.loop().stopReason).toBe("done");
    expect(ran).toBe(1);
    expect(h.loop().grants).toEqual([]);
  });

  test("each item starts in a fresh context, with the earlier items' notes and the person's standing instructions", async () => {
    const h = await setup(["Write the lexer", "Add tests"]);
    let release = () => {};
    let readStarted = () => {};
    const reading = new Promise<void>((r) => (readStarted = r));
    h.ideMessenger.responseHandlers["tools/call"] = async () => {
      readStarted();
      await new Promise<void>((r) => (release = r));
      return {
        contextItems: [{ name: "a.ts", description: "a.ts", content: "src" }],
      };
    };
    h.turns.push(
      calls({ name: BuiltInToolNames.ReadFile, args: { filepath: "a.ts" } }),
      calls({
        name: BuiltInToolNames.FinishItem,
        args: {
          outcome: "done",
          summary: "lexer written",
          notes: "Run the tests with npm test -- --run",
        },
      }),
      finish("done", "tests added"),
    );
    await h.start();
    await reading;

    // A note for every item, given while item 1 runs
    await act(async () => {
      fireEvent.change(
        document.querySelector("[data-testid=loop-plan-note]")!,
        { target: { value: "Never edit generated files" } },
      );
      fireEvent.click(document.querySelector("[data-testid=loop-standing]")!);
    });
    await act(async () => {
      fireEvent.click(
        document.querySelector("[data-testid=loop-plan-note-send]")!,
      );
    });
    expect(h.loop().answers[0].route).toBe("standing");
    expect(
      document.querySelector("[data-testid=loop-standing-list]")!.textContent,
    ).toContain("Never edit generated files");

    await act(async () => release());
    await waitFor(() => expect(h.loop().status).toBe("stopped"));
    expect(h.loop().stopReason).toBe("done");

    // Item 2's request: none of item 1's turns, but its notes and the instruction
    const all = h.requests[2].messages.map(text).join(" ");
    expect(h.prompt(2)).toContain("only this item: Add tests");
    expect(all).not.toContain("only this item: Write the lexer");
    expect(h.prompt(2)).toContain("Run the tests with npm test -- --run");
    expect(h.prompt(2)).toContain("Never edit generated files");
    // The chat still shows every turn
    const shown = h.store
      .getState()
      .session.history.map((i) => text(i.message))
      .join(" ");
    expect(shown).toContain("only this item: Write the lexer");
  });

  test("in YOLO the loop starts unattended and a bounded re-plan starts the next round without the card", async () => {
    const h = await setup(["Write the lexer", "Add tests"]);
    await act(async () => {
      h.store.dispatch(setApprovalMode("yolo"));
    });
    h.turns.push(
      finish("done", "lexer written"),
      finish("stuck", "no test runner installed"),
      calls({
        name: BuiltInToolNames.PresentPlan,
        args: {
          title: "Build the parser",
          plan: "Parse the grammar.",
          todos: ["Write the lexer", "Install vitest", "Add tests"],
        },
      }),
      finish("done", "vitest installed"),
      finish("done", "tests added"),
    );
    await h.start();
    expect(h.loop().autonomy).toBe("unattended");
    expect(h.loop().budget.maxRounds).toBe(10);

    // Nobody clicks Continue the loop
    await waitFor(() => expect(h.loop().status).toBe("stopped"));
    expect(h.loop().stopReason).toBe("done");
    expect(h.loop().round).toBe(2);
    expect(h.loop().replanReason).toBe(
      "The re-plan adds 1 new to-do, within 5.",
    );
    expect(h.prompt(3)).toContain("only this item: Install vitest");
  });

  test("unattended: when the wait for an answer runs out, the item goes on with its default and the question stays open", async () => {
    const h = await setup(["Pick the database"]);
    await act(async () => {
      h.store.dispatch(setApprovalMode("yolo"));
    });
    h.turns.push(
      ask("Item 'Pick the database': Postgres or SQLite?", "blocking"),
      finish("waiting", "needs the database choice"),
      finish("done", "picked SQLite as the default"),
    );
    await h.start();
    await waitFor(() => expect(h.loop().status).toBe("waiting"));
    expect(
      document.querySelector("[data-testid=loop-status]")!.textContent,
    ).toContain("goes on without answers at");

    // As if 16 minutes had passed: the driver's timer fires at once
    await act(async () => {
      h.store.dispatch(
        setLoop({
          ...h.loop(),
          waitingSince: new Date(Date.now() - 16 * 60_000).toISOString(),
        }),
      );
    });
    await waitFor(() => expect(h.loop().status).toBe("stopped"));
    expect(h.loop().stopReason).toBe("done");
    expect(h.prompt(2)).toContain("Nobody answered these questions in time");
    expect(h.prompt(2)).toContain("Postgres or SQLite?");
    // Not confirmed on the person's behalf: still in the inbox
    expect(h.loop().questions[0].answerId).toBeUndefined();
    expect(
      document.querySelector("[data-testid=loop-question-q1]"),
    ).not.toBeNull();
  });

  test("the level picker changes how much the running loop does alone", async () => {
    const h = await setup(["Pick the grammar"]);
    h.turns.push(
      ask("Item 'Pick the grammar': ABNF or PEG?", "blocking"),
      finish("waiting", "needs the grammar"),
    );
    await h.start();
    // Manual approval mode: supervised
    expect(h.loop().autonomy).toBe("supervised");
    await waitFor(() => expect(h.loop().status).toBe("waiting"));
    expect(
      document.querySelector("[data-testid=loop-status]")!.textContent,
    ).toContain("paused until you answer");

    await act(async () => {
      fireEvent.change(document.querySelector("[data-testid=loop-autonomy]")!, {
        target: { value: "unattended" },
      });
    });
    expect(h.loop().autonomy).toBe("unattended");
    expect(h.loop().budget.maxRounds).toBe(10);
    expect(
      document.querySelector("[data-testid=loop-status]")!.textContent,
    ).toContain("goes on without answers at");
  });

  test("a failed model request stops the loop as an error, not as the person's Stop", async () => {
    const h = await setup(["Write the lexer"]);
    h.turns.push(async function* () {
      throw new Error("the server closed the connection");
    });
    await h.start();
    await waitFor(() => expect(h.loop().status).toBe("stopped"));
    expect(h.loop().stopReason).toBe("error");
    expect(h.loop().stopDetail).toContain("The model request failed");
    expect(h.itemStatus("1")).toBe("pending");
  });

  test("an overloaded request is retried without stopping the loop", async () => {
    const h = await setup(["Write the lexer"]);
    h.turns.push(
      async function* () {
        throw new Error("Overloaded");
      },
      finish("done", "lexer written"),
    );
    await h.start();
    await waitFor(() => expect(h.loop().stopReason).toBe("done"), {
      timeout: 15_000,
    });
    expect(h.itemStatus("1")).toBe("done");
    expect(h.requests).toHaveLength(2);
  }, 20_000);

  async function startWithTurnLimit(h: Awaited<ReturnType<typeof setup>>) {
    // The first read holds the run open while the limit is set
    let release = () => {};
    let started = () => {};
    const firstRead = new Promise<void>((r) => (started = r));
    let reads = 0;
    h.ideMessenger.responseHandlers["tools/call"] = async () => {
      reads++;
      if (reads === 1) {
        started();
        await new Promise<void>((r) => (release = r));
      }
      return {
        contextItems: [{ name: "a", description: "a", content: "src" }],
      };
    };
    await h.start();
    await firstRead;
    await act(async () => {
      h.store.dispatch(
        setLoop({
          ...h.loop(),
          budget: { ...h.loop().budget, maxItemTurns: 2, maxRounds: 1 },
        }),
      );
    });
    await act(async () => release());
    return () => reads;
  }

  const read = (filepath: string) =>
    calls({ name: BuiltInToolNames.ReadFile, args: { filepath } });

  test("at its turn limit an item may only report", async () => {
    const h = await setup(["Write the lexer"]);
    h.turns.push(read("a.ts"), read("b.ts"), finish("done", "wrapped up"));
    const reads = await startWithTurnLimit(h);
    await waitFor(() => expect(h.loop().stopReason).toBe("done"));
    expect(reads()).toBe(1);
    expect(h.requests[2].messages.map(text).join(" ")).toContain(
      "requests on this item, so this call was not run",
    );
  });

  test("an item that keeps going past its limit is ended as stuck", async () => {
    const h = await setup(["Write the lexer"]);
    h.turns.push(...Array.from({ length: 12 }, (_, i) => read(`f${i}.ts`)));
    const reads = await startWithTurnLimit(h);
    await waitFor(() => expect(h.loop().status).toBe("stopped"), {
      timeout: 15_000,
    });
    expect(reads()).toBe(1);
    expect(h.requests).toHaveLength(12);
    expect(h.itemStatus("1")).toBe("failed");
    expect(h.loop().items[0].summary).toBe(
      "Ended after 12 requests without reporting.",
    );
    expect(h.loop().stopReason).toBe("rounds");
  }, 20_000);

  test("past its limit an item can still write what it researched", async () => {
    const h = await setup(["Write the report"]);
    h.turns.push(
      read("a.ts"),
      read("b.ts"),
      calls({
        name: BuiltInToolNames.RunTerminalCommand,
        args: { command: "npm test" },
      }),
      finish("done", "written"),
    );
    // Not read-only, so it is not refused at the limit; policy still holds it
    await startWithTurnLimit(h);
    await waitFor(() => expect(h.loop().status).toBe("stopped"));
    expect(h.loop().stopReason).toBe("done");
    expect(h.loop().questions[0].kind).toBe("approval");
    expect(h.requests[3].messages.map(text).join(" ")).not.toContain(
      "Stop reading and searching. Write what the item needs now, in as few calls as you can, then call finish_item: outcome done",
    );
  });

  test("a tool call cut off at the output limit is not run, and the model is told to write in parts", async () => {
    const h = await setup(["Write the report"]);
    let called = 0;
    h.ideMessenger.responseHandlers["tools/call"] = async () => {
      called++;
      return {
        contextItems: [{ name: "r", description: "r", content: "created" }],
      };
    };
    const cutOff: Turn = async function* () {
      yield [
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "cut-off",
              type: "function" as const,
              function: {
                name: BuiltInToolNames.ReadFile,
                arguments: '{"filepath":"big.md","contents":"line 1',
              },
            },
          ],
        },
      ];
    };
    h.turns.push(cutOff, finish("done", "written in parts"));
    await h.start();
    await waitFor(() => expect(h.loop().stopReason).toBe("done"));
    await waitFor(() => expect(h.itemStatus("1")).not.toBe("running"));
    expect(called).toBe(0);
    expect(h.requests[1].messages.map(text).join(" ")).toContain(
      "cut off at the output limit",
    );
    // The partial arguments are not kept or sent back: invalid JSON there can
    // fail a provider, and they would be re-sent with every later request
    const stored = h.store
      .getState()
      .session.history.flatMap((i) => i.toolCallStates ?? [])
      .find((tc) => tc.toolCallId === "cut-off")!;
    expect(stored.toolCall.function.arguments).toBe("{}");
    expect(stored.parsedArgs).toEqual({});
    expect(h.requests[1].messages.map(text).join(" ")).not.toContain("line 1");
  });

  test("a call repeated with no file change is refused once, then the run ends as stuck", async () => {
    const h = await setup(["Run the tests"]);
    let runs = 0;
    h.ideMessenger.responseHandlers["tools/call"] = async () => {
      runs++;
      return {
        contextItems: [{ name: "r", description: "r", content: "1 failed" }],
      };
    };
    const again = () =>
      calls({ name: BuiltInToolNames.ReadFile, args: { filepath: "a.ts" } });
    h.turns.push(again(), again(), again(), again(), again());
    await h.start();
    await waitFor(() => expect(h.itemStatus("1")).toBe("failed"));
    expect(runs).toBe(3);
    expect(h.requests[4].messages.map(text).join(" ")).toContain(
      "with no file change in between",
    );
    expect(h.loop().items[0].summary).toContain("Kept repeating read_file");
  });

  test("the same call after a file change is not counted as a repeat", async () => {
    const h = await setup(["Fix the test"]);
    let runs = 0;
    h.ideMessenger.responseHandlers["tools/call"] = async () => {
      runs++;
      return {
        contextItems: [{ name: "r", description: "r", content: "output" }],
      };
    };
    const test = () =>
      calls({ name: BuiltInToolNames.ReadFile, args: { filepath: "a.ts" } });
    const edit = (n: number) =>
      calls({
        name: BuiltInToolNames.CreateNewFile,
        args: { filepath: `new${n}.ts`, contents: "x" },
      });
    await act(async () => {
      h.store.dispatch(setApprovalMode("yolo"));
    });
    h.ideMessenger.responseHandlers["tools/evaluatePolicy"] = async () => ({
      policy: "allowedWithoutPermission",
      source: "yolo",
    });
    h.turns.push(
      test(),
      test(),
      test(),
      edit(1),
      test(),
      test(),
      test(),
      finish("done", "fixed"),
    );
    await h.start();
    await waitFor(() => expect(h.loop().stopReason).toBe("done"), {
      timeout: 15_000,
    });
    expect(h.requests).toHaveLength(8);
    expect(runs).toBe(7);
  }, 20_000);

  test("an approved write still runs when the model rewrites it with different text", async () => {
    const h = await setup(["Write the report"]);
    let written = 0;
    h.ideMessenger.responseHandlers["tools/call"] = async () => {
      written++;
      return {
        contextItems: [{ name: "r", description: "r", content: "created" }],
      };
    };
    const write = (contents: string) =>
      calls({
        name: BuiltInToolNames.CreateNewFile,
        args: { filepath: "report.md", contents },
      });
    h.turns.push(
      write("first draft"),
      finish("waiting", "needs approval to write"),
      write("second draft, reworded"),
      finish("done", "written"),
    );
    await h.start();
    await waitFor(() => expect(h.loop().status).toBe("waiting"));
    expect(written).toBe(0);
    await act(async () => {
      fireEvent.click(document.querySelector("[data-testid=loop-approve]")!);
    });
    await waitFor(() => expect(h.loop().stopReason).toBe("done"));
    expect(written).toBe(1);
    expect(h.loop().questions).toHaveLength(1);
  });

  test("Stop stops the loop with the item back to pending, and Resume goes on", async () => {
    const h = await setup(["Write the lexer"]);
    h.turns.push(async function* (signal) {
      yield [{ role: "assistant", content: "Working" }];
      await new Promise<void>((r) =>
        signal.addEventListener("abort", () => r(), { once: true }),
      );
    }, finish("done"));
    await h.start();
    await waitFor(() =>
      expect(h.store.getState().session.isStreaming).toBe(true),
    );
    const { cancelStream } = await import("../../../redux/thunks/cancelStream");
    await act(async () => {
      await h.store.dispatch(cancelStream());
    });
    await waitFor(() => expect(h.loop().status).toBe("stopped"));
    expect(h.loop().stopReason).toBe("stopped");
    expect(h.itemStatus("1")).toBe("pending");

    await act(async () => {
      fireEvent.click(document.querySelector("[data-testid=loop-resume]")!);
    });
    await waitFor(() => expect(h.loop().stopReason).toBe("done"));
  });
});
