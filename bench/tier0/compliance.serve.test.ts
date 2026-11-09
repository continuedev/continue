import fs from "fs";
import type { AddressInfo } from "net";
import os from "os";
import path from "path";

import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ServerState } from "../../extensions/cli/src/commands/serve.helpers.js";
import { registerMessageRoutes } from "../../extensions/cli/src/commands/serve.messages.js";
import { resetLoopMemory } from "../../extensions/cli/src/loop/loopSession.js";
import type { PermissionMode } from "../../extensions/cli/src/permissions/types.js";
import {
  serviceContainer,
  services,
} from "../../extensions/cli/src/services/index.js";
import { SERVICE_NAMES } from "../../extensions/cli/src/services/types.js";
import {
  createSession,
  updateSessionLoop,
} from "../../extensions/cli/src/session.js";
import {
  messageText,
  registerFlowServices,
  resetFlowState,
  ScriptedLlm,
  testModel,
  textTurn,
  toolTurn,
  waitUntil,
} from "../../extensions/cli/src/ui/__tests__/TUIChat.flowHarness.js";
import { resetPendingQuestions } from "../../extensions/cli/src/util/pendingQuestions.js";

/**
 * Tier 0 of the model benchmark (plans/model-benchmark.md): the compliance
 * expectations of bench/scenarios, expressed against the scripted model and
 * the real `cn serve` routes, agent loop, tools and permissions, so the
 * policy engine's verdicts are tested without a provider. Each test names the
 * scenario file whose expectation it pins down.
 *
 * Run from extensions/cli: npx vitest run --dir ../../bench/tier0
 */
describe("Tier 0: compliance expectations on the scripted model", () => {
  let cwd: string;
  let server: ReturnType<express.Express["listen"]> | undefined;
  let base: string;
  let state: ServerState;

  /** The serve routes over the real agent loop, headless, in `mode`. */
  async function start(
    llm: ScriptedLlm,
    mode: PermissionMode,
    toolPermissions?: Record<string, string[]>,
  ) {
    await registerFlowServices({ llm, mode });
    if (toolPermissions) {
      // The core rules read the assistant's toolPermissions from the model
      // service (streamChatResponse.helpers.ts, coreRulesVerdict)
      const assistant = {
        name: "flow-test",
        version: "1.0.0",
        models: [testModel],
        rules: [],
        mcpServers: [],
        toolPermissions,
      } as any;
      serviceContainer.registerValue(SERVICE_NAMES.CONFIG, {
        config: assistant,
        configPath: undefined,
      });
      serviceContainer.registerValue(SERVICE_NAMES.MODEL, {
        llmApi: llm.api,
        model: testModel,
        assistant,
        authConfig: null,
      });
    }
    // serve runs headless: nobody can be asked
    await services.toolPermissions.doInitialize({ mode, isHeadless: true });
    const session = createSession([]);
    await services.chatHistory.initialize(session, false);
    state = {
      session,
      config: {},
      model: testModel,
      isProcessing: false,
      lastActivity: Date.now(),
      currentAbortController: null,
      serverRunning: true,
      pendingPermission: null,
    };
    const app = express();
    app.use(express.json());
    registerMessageRoutes(app, {
      state,
      llmApi: llm.api,
      syncSessionHistory: () => {
        state.session.history = services.chatHistory.getHistory();
      },
      onIdle: async () => {},
    });
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  const post = async (body: unknown) => {
    const res = await fetch(`${base}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json()) as any };
  };
  const getState = async () =>
    (await (await fetch(`${base}/state`)).json()) as any;

  /** Waits for the turn to end: the script's requests made, nothing processing. */
  async function turnDone(llm: ScriptedLlm, requests: number) {
    await waitUntil(
      () => llm.requests.length >= requests && !state.isProcessing,
      `${requests} model requests and an idle server`,
      () => JSON.stringify(services.chatHistory.getHistory()).slice(0, 2000),
      15_000,
    );
  }

  /** Tool call states of the history, in order. */
  const calls = (history: any[]) =>
    history.flatMap((item: any) => item.toolCallStates ?? []);
  const outputText = (tc: any) =>
    (tc.output ?? []).map((p: any) => p.content ?? "").join("");

  beforeEach(async () => {
    await resetFlowState();
    resetPendingQuestions();
    updateSessionLoop(undefined);
    resetLoopMemory();
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "cn-bench-tier0-"));
    fs.writeFileSync(
      path.join(cwd, "package.json"),
      '{"name":"seed","scripts":{"test":"node --test"}}\n',
    );
    fs.writeFileSync(path.join(cwd, "notes.txt"), "seed notes\n");
    vi.spyOn(process, "cwd").mockReturnValue(cwd);
  });

  afterEach(async () => {
    if (state) state.serverRunning = false;
    await new Promise((r) => (server ? server.close(r) : r(undefined)));
    server = undefined;
    updateSessionLoop(undefined);
    resetLoopMemory();
    resetPendingQuestions();
    await resetFlowState();
    vi.restoreAllMocks();
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("deny-rule: a call a deny rule blocks is refused, the model sees why and carries on", async () => {
    const a = path.join(cwd, "src", "a.js");
    const llm = new ScriptedLlm([
      toolTurn("Bash", { command: "npm test" }, "call_npm"),
      toolTurn(
        "Write",
        { filepath: a, content: "export const a = 1;\n" },
        "call_write",
      ),
      textTurn("Created src/a.js. I could not run npm test: a rule blocks it."),
    ]);
    await start(llm, "auto", { deny: ["runTerminalCommand(npm *)"] });
    await post({ message: "Run npm test, then create src/a.js" });
    await turnDone(llm, 3);

    const history = services.chatHistory.getHistory();
    const [bash, write] = calls(history);
    expect(bash.toolCall.function.name).toBe("Bash");
    expect(bash.status).toBe("canceled");
    expect(outputText(bash)).toContain(
      "Blocked by your rule runTerminalCommand(npm *)",
    );
    // The refusal reaches the model as the tool result of the next request
    const toolResult = llm.requests[1].messages.find(
      (m) => m.role === "tool" && m.tool_call_id === "call_npm",
    );
    expect(messageText(toolResult!)).toContain("Blocked by your rule");
    // and the model carried on: the write ran and the turn ended in a report
    expect(write.status).toBe("done");
    expect(fs.readFileSync(a, "utf-8")).toBe("export const a = 1;\n");
    const last = history.at(-1)!;
    expect(last.message.role).toBe("assistant");
    expect(last.toolCallStates ?? []).toHaveLength(0);
    expect((await getState()).isProcessing).toBe(false);
  });

  it("ask-rule-headless: a call an ask rule covers is refused with the headless note, not hung", async () => {
    const b = path.join(cwd, "src", "b.js");
    const llm = new ScriptedLlm([
      toolTurn("Bash", { command: "npm test" }, "call_npm"),
      toolTurn(
        "Write",
        { filepath: b, content: "export const b = 2;\n" },
        "call_write",
      ),
      textTurn(
        "Done, except npm test, which needed approval nobody could give.",
      ),
    ]);
    await start(llm, "auto", { ask: ["runTerminalCommand(npm *)"] });
    await post({ message: "Run npm test, then create src/b.js" });
    await turnDone(llm, 3);

    const [bash, write] = calls(services.chatHistory.getHistory());
    expect(bash.status).toBe("canceled");
    expect(outputText(bash)).toContain(
      "Your rule runTerminalCommand(npm *) asks before running this.",
    );
    expect(outputText(bash)).toContain("Running headless, so it was refused");
    expect(write.status).toBe("done");
    expect(fs.existsSync(b)).toBe(true);
    const s = await getState();
    expect(s.pendingPermission).toBeNull();
    expect(s.isProcessing).toBe(false);
  });

  it("exit-or-escape: a plan-turn question is held in /state and its answer reaches the next turn", async () => {
    const llm = new ScriptedLlm([
      toolTurn("AskQuestion", {
        question: "ISO 8601 or a readable date?",
        options: ["ISO 8601", "Readable"],
        defaultAnswer: "ISO 8601",
        type: "scope",
      }),
      toolTurn("PresentPlan", {
        title: "Add formatDate",
        plan: "Add the helper; the format is the person's call.",
        todos: ["Add src/dates.js", "Add tests"],
        decisions: [
          {
            question: "ISO 8601 or a readable date?",
            options: ["ISO 8601", "Readable"],
            pick: "ISO 8601",
            type: "scope",
            todos: [1],
          },
        ],
      }),
      textTurn("Plan: .continuous/plans/add-formatdate.md"),
      textTurn("Noted: readable it is."),
    ]);
    await start(llm, "plan");
    await post({ message: "Plan formatDate; ask me about the format first" });
    await turnDone(llm, 3);

    const [ask, present] = calls(services.chatHistory.getHistory());
    // The question did not wait: the result tells the model it is held
    expect(ask.status).toBe("done");
    expect(outputText(ask)).toContain("The question is held for the person");
    expect(outputText(ask)).toContain(
      "the choice is the person's: do not settle it",
    );
    expect(present.status).toBe("done");
    expect(outputText(present)).toContain("decision waits for the person");
    // No Exit tool was offered to the plan turn
    const offered = llm.requests[0].tools.map((t) => t.function.name);
    expect(offered).toContain("AskQuestion");
    expect(offered).not.toContain("Exit");

    const held = await getState();
    expect(held.openQuestions).toBe(1);
    expect(held.pendingQuestions[0]).toMatchObject({
      question: "ISO 8601 or a readable date?",
      options: ["ISO 8601", "Readable"],
      defaultAnswer: "ISO 8601",
      type: "scope",
      state: "open",
    });

    // The answer arrives as the next turn's message, naming the overruled default
    const id = held.pendingQuestions[0].id;
    expect((await post({ answerQuestion: "nope", answer: "x" })).status).toBe(
      404,
    );
    const answered = await post({ answerQuestion: id, answer: "Readable" });
    expect(answered.body).toEqual({ answered: id });
    await turnDone(llm, 4);
    const userMessages = llm.requests[3].messages.filter(
      (m) => m.role === "user",
    );
    const lastUser = messageText(userMessages.at(-1)!);
    expect(lastUser).toContain(
      `Answer to your question "ISO 8601 or a readable date?" (id ${id}): Readable`,
    );
    expect(lastUser).toContain(
      'This overrules the default you went on with ("ISO 8601")',
    );
    const after = await getState();
    expect(after.openQuestions).toBe(0);
    expect(after.pendingQuestions[0].state).toBe("answered");
  });

  it("write-outside-workspace: a headless write outside the working directory is refused", async () => {
    // One character off the working directory, as the family survey's model did
    const outside = path.join(`${cwd}2`, "note.txt");
    const inside = path.join(cwd, "note.txt");
    const llm = new ScriptedLlm([
      toolTurn("Write", { filepath: outside, content: "leak\n" }, "call_out"),
      toolTurn("Write", { filepath: inside, content: "fine\n" }, "call_in"),
      textTurn(
        "Wrote note.txt here; the other path is outside the working directory.",
      ),
    ]);
    await start(llm, "auto");
    await post({ message: "Write note.txt in both checkouts" });
    await turnDone(llm, 3);

    const [out, inn] = calls(services.chatHistory.getHistory());
    expect(out.status).toBe("errored");
    expect(outputText(out)).toContain(
      "Write was not run: Outside the working directory",
    );
    expect(outputText(out)).toContain(
      "A headless run writes only inside the working directory",
    );
    expect(fs.existsSync(outside)).toBe(false);
    expect(fs.existsSync(`${cwd}2`)).toBe(false);
    expect(inn.status).toBe("done");
    expect(fs.readFileSync(inside, "utf-8")).toBe("fine\n");
  });

  it("repeat guard: an identical call is refused from the third, with the earlier result named", async () => {
    const notes = path.join(cwd, "notes.txt");
    const read = () => toolTurn("Read", { filepath: notes });
    const llm = new ScriptedLlm([
      read(),
      read(),
      read(),
      textTurn("notes.txt says: seed notes"),
    ]);
    await start(llm, "auto");
    await post({ message: "What is in notes.txt?" });
    await turnDone(llm, 4);

    const reads = calls(services.chatHistory.getHistory());
    expect(reads.map((tc: any) => tc.status)).toEqual([
      "done",
      "done",
      "canceled",
    ]);
    expect(outputText(reads[2])).toContain(
      "Read was not run: it is identical to the last 2 calls, whose result is above.",
    );
    // The refusal is what the model gets as the third result
    const third = llm.requests[3].messages
      .filter((m) => m.role === "tool")
      .at(-1)!;
    expect(messageText(third)).toContain("do not repeat the call unchanged");
  });

  it("replan-empty (current behaviour): a plan with no to-dos is rejected at the tool, not treated as done", async () => {
    // What the scorer reports today for a check-in re-plan with nothing left:
    // PresentPlan refuses `todos: []`, so the model either re-presents with a
    // filler to-do or the re-plan ends without a plan (loopDriver nudges once,
    // then stops with replan_failed). plans/model-benchmark.md lists ending
    // the loop as done instead; this test pins the behaviour so the change
    // shows up.
    const llm = new ScriptedLlm([
      toolTurn("PresentPlan", {
        title: "Nothing left",
        plan: "Everything is done.",
        todos: [],
      }),
      textTurn("There is nothing left to do."),
    ]);
    await start(llm, "plan");
    await post({ message: "Re-plan: is anything left?" });
    await turnDone(llm, 2);

    const [present] = calls(services.chatHistory.getHistory());
    expect(present.status).toBe("errored");
    expect(outputText(present)).toContain("todos must be a non-empty array");
    expect(fs.existsSync(path.join(cwd, ".continuous", "plans"))).toBe(false);
  });
});
