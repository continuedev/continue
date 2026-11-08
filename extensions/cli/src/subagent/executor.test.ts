import { beforeEach, describe, expect, it, vi } from "vitest";

import { fireSubagentStart, fireSubagentStop } from "../hooks/fireHook.js";
import { checkToolPermission } from "../permissions/permissionChecker.js";
import { toolPermissionManager } from "../permissions/permissionManager.js";
import { serviceContainer } from "../services/ServiceContainer.js";
import { SERVICE_NAMES } from "../services/types.js";
import { streamChatResponse } from "../stream/streamChatResponse.js";
import type { StreamCallbacks } from "../stream/streamChatResponse.types.js";

import {
  executeSubAgent,
  MAX_SUBAGENT_STOP_CONTINUATIONS,
  type SubAgentExecutionOptions,
} from "./executor.js";

const parentPermissions = {
  permissions: {
    policies: [
      { tool: "Read", permission: "allow" },
      { tool: "Edit", permission: "ask" },
    ],
  },
  currentMode: "normal",
  isHeadless: false,
} as any;

vi.mock("../stream/streamChatResponse.js", () => ({
  streamChatResponse: vi.fn(),
}));
// A container that remembers what was set and announces it, like the real one.
vi.mock("../services/ServiceContainer.js", async () => {
  const { EventEmitter } = await import("node:events");
  const container = new EventEmitter() as any;
  container.values = new Map();
  container.get = vi.fn(async (name: string) => container.values.get(name));
  container.set = vi.fn((name: string, value: unknown) => {
    container.values.set(name, value);
    container.emit(`${name}:ready`, value);
  });
  return { serviceContainer: container };
});
vi.mock("../services/index.js", () => ({
  services: {
    systemMessage: { getSystemMessage: vi.fn(async () => "parent system") },
    toolPermissions: { getState: () => parentPermissions },
    chatHistory: { isReady: () => true },
  },
}));
vi.mock("../hooks/fireHook.js", () => ({
  fireSubagentStart: vi.fn(),
  fireSubagentStop: vi.fn(),
}));
vi.mock("../util/logger.js", () => ({
  logger: { debug: vi.fn(), error: vi.fn() },
}));

const NOOP_HOOK = { blocked: false, results: [] };
const PERMISSIONS = SERVICE_NAMES.TOOL_PERMISSIONS;

const agent = {
  model: { name: "explorer", chatOptions: { baseSystemMessage: "explore" } },
  llmApi: {},
} as any;

type StreamImpl = (
  history: any[],
  callbacks: StreamCallbacks,
  abortController: AbortController,
) => Promise<void>;

function mockStream(impl: StreamImpl) {
  vi.mocked(streamChatResponse).mockImplementation(
    async (history: any, _m, _l, abortController, callbacks) => {
      await impl(history, callbacks!, abortController);
      return "";
    },
  );
}

const run = (prompt: string, extra: Partial<SubAgentExecutionOptions> = {}) =>
  executeSubAgent({
    agent,
    agentName: "explorer",
    prompt,
    parentSessionId: "p",
    abortController: new AbortController(),
    ...extra,
  });

const currentPermissions = () =>
  (serviceContainer as any).values.get(PERMISSIONS);

describe("executeSubAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (serviceContainer as any).values.set(PERMISSIONS, parentPermissions);
    vi.mocked(fireSubagentStart).mockReset().mockResolvedValue(NOOP_HOOK);
    vi.mocked(fireSubagentStop).mockReset().mockResolvedValue(NOOP_HOOK);
  });

  it("runs parallel subagents one after another and restores the parent's permissions", async () => {
    const events: string[] = [];
    mockStream(async (history, callbacks) => {
      const name = history[0].message.content;
      events.push(`start ${name}`);
      await new Promise((r) => setTimeout(r, 20));
      callbacks.onContent?.(`done ${name}`);
      events.push(`end ${name}`);
    });

    const [a, b] = await Promise.all([run("a"), run("b")]);

    expect(events).toEqual(["start a", "end a", "start b", "end b"]);
    expect(a).toEqual({
      success: true,
      status: "completed",
      response: "done a",
      toolCalls: [],
    });
    expect(b).toMatchObject({ status: "completed", response: "done b" });

    // Each run sets the subagent's permissions, then puts the parent's back
    const sets = vi.mocked(serviceContainer.set).mock.calls.map((c) => c[1]);
    expect(sets.at(-1)).toBe(parentPermissions);
    expect(sets[0]).not.toBe(parentPermissions);
  });

  it("a failing run does not block the next one, and keeps what it wrote", async () => {
    vi.mocked(streamChatResponse)
      .mockImplementationOnce(async (_h, _m, _l, _a, callbacks) => {
        callbacks?.onContent?.("halfway");
        throw new Error("boom");
      })
      .mockImplementationOnce(async (_h, _m, _l, _a, callbacks) => {
        callbacks?.onContent?.("ok");
        return "";
      });

    const [failed, ok] = await Promise.all([run("x"), run("y")]);

    expect(failed).toMatchObject({
      success: false,
      status: "failed",
      error: "boom",
      response: "halfway",
    });
    expect(ok).toMatchObject({ success: true, response: "ok" });
    expect(currentPermissions()).toBe(parentPermissions);
  });

  describe("cancellation", () => {
    it("returns what the subagent wrote so far with status cancelled", async () => {
      const abortController = new AbortController();
      mockStream(async (_h, callbacks, controller) => {
        callbacks.onContent?.("Found two files so far");
        abortController.abort();
        expect(controller.signal.aborted).toBe(true);
      });

      const result = await run("look", { abortController });

      expect(result).toMatchObject({
        success: false,
        status: "cancelled",
        response: "Found two files so far",
        error: "Cancelled by the user",
      });
      expect(currentPermissions()).toBe(parentPermissions);
    });

    it("reports the abort reason when one is given", async () => {
      const abortController = new AbortController();
      mockStream(async () => {
        abortController.abort("Interrupted from serve");
      });

      const result = await run("look", { abortController });
      expect(result).toMatchObject({
        status: "cancelled",
        error: "Interrupted from serve",
      });
    });

    it("treats an abort error from the stream as a cancel, not a failure", async () => {
      const abortController = new AbortController();
      vi.mocked(streamChatResponse).mockImplementationOnce(async () => {
        abortController.abort();
        const error = new Error("aborted");
        error.name = "AbortError";
        throw error;
      });

      const result = await run("look", { abortController });
      expect(result.status).toBe("cancelled");
    });

    it("does not start a queued run whose parent was cancelled while it waited", async () => {
      let release!: () => void;
      mockStream(async (_h, callbacks) => {
        await new Promise<void>((r) => (release = r));
        callbacks.onContent?.("first");
      });

      const second = new AbortController();
      const firstRun = run("first");
      const secondRun = run("second", { abortController: second });
      second.abort();
      await vi.waitFor(() => expect(release).toBeDefined());
      release();

      expect(await firstRun).toMatchObject({ status: "completed" });
      expect(await secondRun).toMatchObject({ status: "cancelled" });
      expect(streamChatResponse).toHaveBeenCalledTimes(1);
    });

    it("rejects a permission prompt still open when the run is cancelled", async () => {
      const abortController = new AbortController();
      const parentPrompt = vi.fn();
      let decision: Promise<{ approved: boolean }> | undefined;
      mockStream(async (_h, callbacks) => {
        toolPermissionManager.once("permissionRequested", ({ requestId }) => {
          callbacks.onToolPermissionRequest?.("Edit", {}, requestId);
        });
        decision = toolPermissionManager.requestPermission({
          name: "Edit",
          arguments: {},
        });
        abortController.abort();
      });

      await run("edit", {
        abortController,
        onToolPermissionRequest: parentPrompt,
      });

      expect(parentPrompt).toHaveBeenCalledTimes(1);
      await expect(decision).resolves.toMatchObject({ approved: false });
    });
  });

  describe("result", () => {
    it("keeps tool output out and lists the tools by name", async () => {
      const updates: string[] = [];
      mockStream(async (_h, callbacks) => {
        callbacks.onContent?.("Let me look.");
        callbacks.onToolStart?.("Read", { filepath: "src/a.ts" });
        callbacks.onToolResult?.("SECRET FILE CONTENT", "Read", "done");
        callbacks.onToolStart?.("Bash", { command: "npm test" });
        callbacks.onToolError?.("SECRET ERROR OUTPUT", "Bash");
        callbacks.onContent?.("The answer is 42.");
      });

      const result = await run("q", {
        onOutputUpdate: (o) => updates.push(o),
      });

      expect(result).toMatchObject({
        status: "completed",
        response: "The answer is 42.",
        toolCalls: [
          { name: "Read", summary: "src/a.ts", status: "done" },
          { name: "Bash", summary: "npm test", status: "errored" },
        ],
      });
      expect(JSON.stringify(result)).not.toContain("SECRET");
      expect(updates.join("\n")).not.toContain("SECRET");
      expect(updates.at(-1)).toContain("Read src/a.ts (done)");
    });

    it("is partial when the subagent stops after a tool call without answering", async () => {
      mockStream(async (_h, callbacks) => {
        callbacks.onContent?.("Checking the config.");
        callbacks.onToolStart?.("Edit", { filepath: "a.ts" });
        callbacks.onToolResult?.("Permission denied", "Edit", "canceled");
      });

      const result = await run("q");
      expect(result).toMatchObject({
        success: false,
        status: "partial",
        response: "Checking the config.",
      });
      expect(result.error).toMatch(/without giving a final answer/);
    });
  });

  describe("hooks", () => {
    it("fires SubagentStart with the agent id and type, and adds its context before the prompt", async () => {
      vi.mocked(fireSubagentStart).mockResolvedValue({
        ...NOOP_HOOK,
        additionalContext: "Follow the security guidelines",
      });
      mockStream(async (history, callbacks) => {
        callbacks.onContent?.(String(history[0].message.content));
      });

      const result = await run("Do the task");

      expect(fireSubagentStart).toHaveBeenCalledWith(
        expect.stringMatching(/^agent-/),
        "explorer",
      );
      expect(result.response).toBe(
        "Follow the security guidelines\n\nDo the task",
      );
    });

    it("does not let SubagentStart block the run; its message goes to the progress only", async () => {
      vi.mocked(fireSubagentStart).mockResolvedValue({
        blocked: true,
        blockReason: "not allowed today",
        results: [],
      });
      const updates: string[] = [];
      mockStream(async (_h, callbacks) => callbacks.onContent?.("ran"));

      const result = await run("q", { onOutputUpdate: (o) => updates.push(o) });

      expect(result).toMatchObject({ status: "completed", response: "ran" });
      expect(updates.join("\n")).toContain(
        "SubagentStart hook error: not allowed today",
      );
    });

    it("fires SubagentStop with the final answer, the same agent id and stop_hook_active false", async () => {
      mockStream(async (_h, callbacks) => callbacks.onContent?.("All done"));

      await run("q");

      const startId = vi.mocked(fireSubagentStart).mock.calls[0][0];
      expect(fireSubagentStop).toHaveBeenCalledWith({
        agentId: startId,
        agentType: "explorer",
        stopHookActive: false,
        lastAssistantMessage: "All done",
      });
    });

    it("a blocking SubagentStop sends its reason back and keeps the subagent running", async () => {
      vi.mocked(fireSubagentStop)
        .mockResolvedValueOnce({
          blocked: true,
          blockReason: "Run the tests first",
          results: [],
        })
        .mockResolvedValue(NOOP_HOOK);
      let turn = 0;
      mockStream(async (history, callbacks) => {
        turn++;
        if (turn === 2) {
          expect(history.at(-1).message).toEqual({
            role: "user",
            content: "Run the tests first",
          });
        }
        callbacks.onContent?.(`answer ${turn}`);
      });

      const result = await run("q");

      expect(streamChatResponse).toHaveBeenCalledTimes(2);
      expect(vi.mocked(fireSubagentStop).mock.calls[1][0].stopHookActive).toBe(
        true,
      );
      expect(result).toMatchObject({
        status: "completed",
        response: "answer 2",
      });
    });

    it("stops continuing after the cap when SubagentStop always blocks", async () => {
      vi.mocked(fireSubagentStop).mockResolvedValue({
        blocked: true,
        blockReason: "again",
        results: [],
      });
      mockStream(async (_h, callbacks) => callbacks.onContent?.("answer"));

      const result = await run("q");

      expect(streamChatResponse).toHaveBeenCalledTimes(
        MAX_SUBAGENT_STOP_CONTINUATIONS + 1,
      );
      expect(result.status).toBe("completed");
    });

    it("does not fire SubagentStop for a cancelled run", async () => {
      const abortController = new AbortController();
      mockStream(async () => abortController.abort());

      await run("q", { abortController });
      expect(fireSubagentStop).not.toHaveBeenCalled();
    });
  });

  describe("permission prompts", () => {
    it("routes 'ask' to the parent's prompt, labelled with the subagent's name", async () => {
      const parentPrompt = vi.fn();
      let permissionsDuringRun: any;
      let childCallbacks: StreamCallbacks | undefined;
      mockStream(async (_h, callbacks) => {
        permissionsDuringRun = currentPermissions();
        childCallbacks = callbacks;
        callbacks.onToolPermissionRequest?.(
          "Edit",
          { filepath: "a.ts" },
          "tool-request-1",
          [{ type: "diff", content: "+x" }],
        );
        callbacks.onToolPermissionRequest?.(
          "Bash",
          { command: "npm i" },
          "tool-request-2",
        );
        callbacks.onContent?.("done");
      });

      await run("q", { onToolPermissionRequest: parentPrompt });

      expect(childCallbacks?.onToolPermissionRequest).toBeDefined();
      expect(
        checkToolPermission(
          { name: "Edit", arguments: {} },
          permissionsDuringRun.permissions,
        ).permission,
      ).toBe("ask");
      expect(parentPrompt).toHaveBeenNthCalledWith(
        1,
        "Edit",
        { filepath: "a.ts" },
        "tool-request-1",
        [
          {
            type: "text",
            content: 'Subagent "explorer" asks to run Edit',
            color: "yellow",
          },
          { type: "diff", content: "+x" },
        ],
      );
      // Without a preview of its own, the dialog still says what will run
      expect(parentPrompt.mock.calls[1][3]).toEqual([
        expect.objectContaining({
          content: 'Subagent "explorer" asks to run Bash',
        }),
        { type: "text", content: "Will call Bash: npm i" },
      ]);
    });

    it("refuses 'ask' when headless, even with a prompt callback", async () => {
      (serviceContainer as any).values.set(PERMISSIONS, {
        ...parentPermissions,
        isHeadless: true,
      });
      const parentPrompt = vi.fn();
      let permissionsDuringRun: any;
      let childCallbacks: StreamCallbacks | undefined;
      mockStream(async (_h, callbacks) => {
        permissionsDuringRun = currentPermissions();
        childCallbacks = callbacks;
        callbacks.onContent?.("done");
      });

      await run("q", { onToolPermissionRequest: parentPrompt });

      expect(childCallbacks?.onToolPermissionRequest).toBeUndefined();
      expect(
        checkToolPermission(
          { name: "Edit", arguments: {} },
          permissionsDuringRun.permissions,
        ).permission,
      ).toBe("exclude");
    });

    it("refuses 'ask' when there is no parent prompt", async () => {
      let permissionsDuringRun: any;
      mockStream(async (_h, callbacks) => {
        permissionsDuringRun = currentPermissions();
        callbacks.onContent?.("done");
      });

      await run("q");

      expect(
        checkToolPermission(
          { name: "Edit", arguments: {} },
          permissionsDuringRun.permissions,
        ).permission,
      ).toBe("exclude");
    });

    it("keeps the subagent's limits when the parent's permissions change mid-run, and restores the new ones", async () => {
      const reloaded = {
        ...parentPermissions,
        permissions: { policies: [{ tool: "*", permission: "allow" }] },
      };
      let afterReload: any;
      mockStream(async (_h, callbacks) => {
        // "Always allow" on a prompt reloads the parent's permissions
        serviceContainer.set(PERMISSIONS, reloaded);
        afterReload = currentPermissions();
        callbacks.onContent?.("done");
      });

      await run("q");

      expect(afterReload).not.toBe(reloaded);
      expect(
        checkToolPermission(
          { name: "Subagent", arguments: {} },
          afterReload.permissions,
        ).permission,
      ).toBe("exclude");
      expect(
        checkToolPermission(
          { name: "Bash", arguments: { command: "ls" } },
          afterReload.permissions,
        ).permission,
      ).toBe("allow");
      expect(currentPermissions()).toBe(reloaded);
    });
  });
});

describe("executeSubAgent: context budget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (serviceContainer as any).values.set(PERMISSIONS, parentPermissions);
    vi.mocked(fireSubagentStart).mockReset().mockResolvedValue(NOOP_HOOK);
    vi.mocked(fireSubagentStop).mockReset().mockResolvedValue(NOOP_HOOK);
  });

  it("runs with the model's sub-agent budget and does not persist the child history", async () => {
    mockStream(async (_history, callbacks) => {
      callbacks.onContent?.("done");
    });
    const budgeted = {
      model: {
        name: "sub",
        model: "test",
        provider: "openai",
        defaultCompletionOptions: { contextLength: 524_288, maxTokens: 16_384 },
        contextManagement: { subagent: { contextLength: 65_536 } },
      },
      llmApi: {},
    } as any;

    const result = await run("task", { agent: budgeted });

    expect(result.status).toBe("completed");
    const [, usedModel, , , , isCompacting, options] =
      vi.mocked(streamChatResponse).mock.calls[0];
    expect(usedModel.defaultCompletionOptions?.contextLength).toBe(65_536);
    // The parent's model is not changed
    expect(budgeted.model.defaultCompletionOptions.contextLength).toBe(524_288);
    expect(isCompacting).toBe(false);
    expect(options).toEqual({ persistSession: false });
  });
});
