import fs from "fs";
import type { AddressInfo } from "net";
import os from "os";
import path from "path";

import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetLoopMemory } from "../loop/loopSession.js";
import { services } from "../services/index.js";
import {
  createSession,
  getSessionLoop,
  updateSessionLoop,
} from "../session.js";
import { savePlan } from "../tools/presentPlan.js";
import {
  heldTurn,
  messageText,
  registerFlowServices,
  resetFlowState,
  ScriptedLlm,
  testModel,
  toolTurn,
  waitUntil,
} from "../ui/__tests__/TUIChat.flowHarness.js";

import type { ServerState } from "./serve.helpers.js";
import { registerMessageRoutes } from "./serve.messages.js";

/**
 * Loop mode through `cn serve`: the real routes, agent loop, tools, tool
 * permissions (headless, as serve runs) and chat history, with a scripted
 * model. POST /message takes `loopAction` and `loopAnswer`; GET /state
 * reports the loop.
 */
describe("cn serve: Loop mode", () => {
  let cwd: string;
  let server: ReturnType<express.Express["listen"]>;
  let base: string;
  let state: ServerState;

  async function start(llm: ScriptedLlm) {
    await registerFlowServices({ llm, mode: "normal" });
    // serve runs headless: nobody can be asked, so "ask" calls are refused
    // unless the loop holds them
    await services.toolPermissions.doInitialize({
      mode: "normal",
      isHeadless: true,
    });
    const session = createSession([]);
    await services.chatHistory.initialize(session, false);
    services.chatHistory.addUserMessage("an earlier chat about something else");
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
  /** A request's user messages, without the plan block at the end. */
  const userMessages = (request: { messages: any[] }) =>
    request.messages.filter(
      (m) => m.role === "user" && !messageText(m).startsWith("<task_list>"),
    );
  const getState = async () =>
    (await (await fetch(`${base}/state`)).json()) as any;

  beforeEach(async () => {
    await resetFlowState();
    updateSessionLoop(undefined);
    resetLoopMemory();
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "cn-serve-loop-"));
    vi.spyOn(process, "cwd").mockReturnValue(cwd);
  });

  afterEach(async () => {
    state.serverRunning = false;
    await new Promise((r) => server?.close(r));
    updateSessionLoop(undefined);
    resetLoopMemory();
    await resetFlowState();
    vi.restoreAllMocks();
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("runs the plan, steers an answer in, and holds an approval until it is answered", async () => {
    const notes = path.join(cwd, "notes.txt");
    fs.writeFileSync(notes, "retry notes\n");
    const target = path.join(cwd, "retry.ts");
    const write = {
      filepath: target,
      content: "export const withRetry = 1;\n",
    };
    // Item 1's second request waits, so an answer can come in mid-run
    const midRun = heldTurn(toolTurn("Read", { filepath: notes }, "call_read"));
    const llm = new ScriptedLlm([
      // Item 1
      toolTurn("HoldQuestion", {
        question: "Name the helper retry or withRetry? Default retry.",
        kind: "assumption",
        assumption: "retry",
      }),
      midRun.turn,
      toolTurn("FinishItem", { outcome: "done", summary: "Added withRetry" }),
      // Item 2: Write asks, and serve is headless, so the loop holds it
      toolTurn("Write", write, "call_write_1"),
      toolTurn("FinishItem", { outcome: "waiting", summary: "Needs approval" }),
      // Item 2 again, once allowed
      toolTurn("Write", write, "call_write_2"),
      toolTurn("FinishItem", { outcome: "done", summary: "Used it" }),
    ]);
    await start(llm);
    // A headless PresentPlan saved the plan without asking
    await savePlan(
      {
        title: "Add retry",
        plan: "Retry failed fetches.",
        todos: ["Add a retry helper", "Use it in fetch"],
      },
      cwd,
    );

    // Bad requests are refused before anything changes
    expect((await post({ loopAction: "go" })).status).toBe(400);
    expect((await post({ loopAnswer: "yes" })).status).toBe(400);
    expect(
      (await post({ loopAnswer: { text: "x", confirm: "yes" } })).body,
    ).toEqual({ error: "loopAnswer.confirm must be a boolean" });
    expect((await post({ loopAction: "resume" })).status).toBe(400);

    const started = await post({ loopAction: "start" });
    expect(started.status).toBe(200);
    expect(started.body.loop.status).toBe("running");
    expect(started.body.loop.autonomy).toBe("supervised");

    await midRun.started;
    // Item 1 runs from its own prompt: the earlier chat is not sent
    const first = userMessages(llm.requests[0]);
    expect(first).toHaveLength(1);
    expect(messageText(first[0])).toContain(
      "only this item: Add a retry helper",
    );
    const tools = llm.requests[0].tools.map((t) => t.function.name);
    expect(tools).toEqual(
      expect.arrayContaining(["HoldQuestion", "FinishItem", "Write"]),
    );
    expect(tools).not.toContain("TaskList");

    // GET /state has the loop and the open question
    const during = await getState();
    expect(during.loop.current.kind).toBe("item");
    expect(during.loop.questions[0]).toMatchObject({
      id: "q1",
      kind: "assumption",
      assumption: "retry",
    });
    expect(during.loopStatus).toContain("1 open question");

    // An answer for the running item is steered in at its next tool boundary
    const answered = await post({
      loopAnswer: { questionId: "q1", text: "Call it withRetry" },
    });
    expect(answered.body).toMatchObject({ answered: true, route: "steer" });
    expect(
      (await post({ loopAnswer: { questionId: "q9", text: "?" } })).body,
    ).toEqual({ error: "No question q9" });
    midRun.release();

    await waitUntil(
      () => getSessionLoop()?.status === "waiting",
      "the loop to wait on the approval",
      () => JSON.stringify(getSessionLoop()),
    );
    const steered = userMessages(llm.requests[2]);
    expect(messageText(steered[steered.length - 1])).toContain(
      'The person answered your question q1 ("Name the helper retry or withRetry? Default retry."): Call it withRetry',
    );
    // Item 2 starts fresh: item 1's run is not in its request
    const second = userMessages(llm.requests[3]);
    expect(second).toHaveLength(1);
    expect(messageText(second[0])).toContain("only this item: Use it in fetch");
    expect(fs.existsSync(target)).toBe(false);

    const waiting = await getState();
    const approval = waiting.loop.questions.find(
      (q: any) => q.kind === "approval",
    );
    expect(approval.question).toContain("Allow this call? Write:");
    expect(waiting.loopStatus).toContain("paused until you answer");

    // Allow once: the item runs again and the same call goes through
    const allowed = await post({
      loopAnswer: { questionId: approval.id, text: "", approve: true },
    });
    expect(allowed.body).toMatchObject({ answered: true, route: "requeue" });
    await waitUntil(
      () => getSessionLoop()?.status === "stopped",
      "the loop to finish",
      () => JSON.stringify(getSessionLoop()),
    );
    expect(getSessionLoop()?.stopReason).toBe("done");
    expect(fs.readFileSync(target, "utf-8")).toBe(write.content);
    const done = await getState();
    expect(done.loopStatus).toContain("stopped: All 2 items are done.");
    expect(done.isProcessing).toBe(false);
  });

  it("stops the loop after the running item, and resumes it", async () => {
    const run = heldTurn(
      toolTurn("FinishItem", { outcome: "done", summary: "One" }),
    );
    const llm = new ScriptedLlm([
      run.turn,
      toolTurn("FinishItem", { outcome: "done", summary: "Two" }),
    ]);
    await start(llm);
    await savePlan(
      { title: "Two steps", plan: "Two steps.", todos: ["One", "Two"] },
      cwd,
    );
    await post({ loopAction: "start" });
    await run.started;
    expect((await post({ loopAction: "stop" })).body.loop.stopRequested).toBe(
      true,
    );
    const unattended = (await post({ loopAutonomy: "unattended" })).body;
    expect(unattended.loop.autonomy).toBe("unattended");
    // Not picked yet, so the strategy follows the level
    expect(unattended.loop.strategy).toBe("fix-forward");
    expect(await post({ loopStrategy: "ralph" })).toEqual({
      status: 400,
      body: {
        error: "loopStrategy must be one of finish, check-in, fix-forward",
      },
    });
    const picked = (await post({ loopStrategy: "check-in" })).body;
    expect(picked.loop).toMatchObject({
      strategy: "check-in",
      strategyPicked: true,
    });
    expect(picked.loopStatus).toMatch(/^Unattended · Check in · /);
    // A pick stays when the level changes
    expect((await post({ loopAutonomy: "auto" })).body.loop.strategy).toBe(
      "check-in",
    );
    run.release();
    await waitUntil(
      () => getSessionLoop()?.status === "stopped",
      "the loop to stop",
      () => JSON.stringify(getSessionLoop()),
    );
    expect(getSessionLoop()?.stopReason).toBe("stopped");
    expect(llm.requests).toHaveLength(1);

    expect((await post({ loopAction: "resume" })).status).toBe(200);
    await waitUntil(
      () => getSessionLoop()?.stopReason === "done",
      "the loop to finish after Resume",
      () => JSON.stringify(getSessionLoop()),
    );
    expect(llm.requests).toHaveLength(2);
  });

  it("skips an item, runs one again, and changes the limits within bounds", async () => {
    const run = heldTurn(
      toolTurn("FinishItem", { outcome: "done", summary: "One" }),
    );
    const llm = new ScriptedLlm([
      run.turn,
      toolTurn("FinishItem", { outcome: "done", summary: "One again" }),
    ]);
    await start(llm);
    await savePlan(
      { title: "Two steps", plan: "Two steps.", todos: ["One", "Two"] },
      cwd,
    );
    await post({ loopAction: "start" });
    await run.started;

    expect((await post({ loopAction: "skip" })).body).toEqual({
      error: 'loopAction "skip" needs itemId',
    });
    expect((await post({ loopAction: "skip", itemId: "1" })).body).toEqual({
      error: "1 is running: use Stop now, or Stop after this item, instead",
    });
    const skipped = await post({ loopAction: "skip", itemId: "2" });
    expect(skipped.status).toBe(200);
    expect(skipped.body.loop.items[1]).toMatchObject({
      status: "done",
      skipped: true,
    });

    // Limits out of bounds are refused, and nothing changes
    const refused = await post({ loopBudget: { maxRounds: 0 } });
    expect(refused).toEqual({
      status: 400,
      body: { error: "maxRounds must be an integer from 1 to 50" },
    });
    expect(
      (await post({ loopAutonomy: "auto", loopBudget: { maxTokens: 5 } }))
        .status,
    ).toBe(400);
    expect(getSessionLoop()?.autonomy).toBe("supervised");
    const budgeted = await post({
      loopBudget: { maxRounds: 1, maxTokens: 0, maxWallMs: 600_000 },
    });
    expect(budgeted.body.loop.budget).toMatchObject({
      maxRounds: 1,
      maxTokens: 0,
      maxWallMs: 600_000,
    });

    run.release();
    await waitUntil(
      () => getSessionLoop()?.status === "stopped",
      "the loop to finish",
      () => JSON.stringify(getSessionLoop()),
    );
    expect(getSessionLoop()?.stopDetail).toBe(
      "All 2 items are done (1 skipped).",
    );

    // Run item 1 again: the loop waits for Resume, then runs it once more
    const again = await post({ loopAction: "again", itemId: "1" });
    expect(again.body.loop.stopReason).toBe("stopped");
    expect((await post({ loopAction: "resume" })).status).toBe(200);
    await waitUntil(
      () => getSessionLoop()?.stopReason === "done",
      "the loop to finish after Run again",
      () => JSON.stringify(getSessionLoop()),
    );
    expect(llm.requests).toHaveLength(2);
    const rerun = userMessages(llm.requests[1]);
    expect(messageText(rerun[rerun.length - 1])).toContain(
      "the person asked for it to run again",
    );
  });

  it("marks a reminder whose file changed, and shows it in /state", async () => {
    const file = path.join(cwd, "a.txt");
    fs.writeFileSync(file, "before");
    const held = heldTurn(
      toolTurn("FinishItem", { outcome: "done", summary: "One" }),
    );
    const llm = new ScriptedLlm([
      toolTurn("RemindMe", {
        note: "a.txt has the setting",
        when: "next_items",
        files: ["a.txt"],
      }),
      held.turn,
      toolTurn("FinishItem", { outcome: "done", summary: "Two" }),
    ]);
    await start(llm);
    await savePlan(
      { title: "Two steps", plan: "Two steps.", todos: ["One", "Two"] },
      cwd,
    );
    await post({ loopAction: "start" });
    await held.started;

    // Nobody can answer a question box here
    expect(llm.requests[0].tools.map((t) => t.function.name)).not.toContain(
      "AskQuestion",
    );

    const saved = (await getState()).loop.reminders;
    expect(saved).toMatchObject([{ id: "r1", when: "next_items" }]);
    expect(saved[0].deliveredAt).toBeUndefined();
    fs.writeFileSync(file, "after");

    held.release();
    await waitUntil(
      () => getSessionLoop()?.stopReason === "done",
      "the loop to finish",
      () => JSON.stringify(getSessionLoop()),
    );
    expect(messageText(userMessages(llm.requests[2]).at(-1)!)).toContain(
      "- (from item 1; written before these files changed, so check first: a.txt) a.txt has the setting",
    );
    expect((await getState()).loop.reminders[0].deliveredAt).toBeDefined();
  });
});
