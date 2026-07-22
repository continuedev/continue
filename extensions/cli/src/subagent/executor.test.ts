import { describe, test, expect, vi } from "vitest";

// Shared, controllable state for the mocked service container + chat stream so
// we can drive a deterministic interleave of two concurrent subagent runs.
const h = vi.hoisted(() => {
  const MAIN_POLICIES = [{ tool: "read", permission: "allow" }];
  let toolPermissions: any = { permissions: { policies: MAIN_POLICIES } };

  const enter: Array<() => void> = [];
  const enteredPromises: Promise<void>[] = [
    new Promise<void>((r) => (enter[0] = r)),
    new Promise<void>((r) => (enter[1] = r)),
  ];
  const release: Array<() => void> = [];
  const gate: Promise<void>[] = [
    new Promise<void>((r) => (release[0] = r)),
    new Promise<void>((r) => (release[1] = r)),
  ];
  let callIndex = 0;

  return {
    MAIN_POLICIES,
    getPolicies: () => toolPermissions.permissions.policies,
    container: {
      get: async () => toolPermissions,
      set: (_name: string, value: any) => {
        toolPermissions = value;
      },
    },
    enteredPromises,
    release,
    // i-th stream call signals it has begun, then blocks until released.
    streamChatResponse: async () => {
      const i = callIndex++;
      enter[i]?.();
      await gate[i];
    },
  };
});

vi.mock("../services/ServiceContainer.js", () => ({
  serviceContainer: h.container,
}));
vi.mock("../services/index.js", () => ({
  services: { systemMessage: undefined, chatHistory: undefined },
}));
vi.mock("../stream/streamChatResponse.js", () => ({
  streamChatResponse: h.streamChatResponse,
}));
vi.mock("../util/cli.js", () => ({
  escapeEvents: { on: () => {}, removeListener: () => {} },
}));
vi.mock("../util/logger.js", () => ({
  logger: { debug: () => {}, error: () => {}, info: () => {}, warn: () => {} },
}));

import { executeSubAgent } from "./executor.js";

describe("executeSubAgent concurrency", () => {
  test("serializes so a concurrent subagent cannot leave main-agent permissions stuck at allow-all", async () => {
    const agent: any = { model: { name: "sub" }, llmApi: {} };
    const opts = (id: string): any => ({
      agent,
      prompt: id,
      parentSessionId: "p",
      abortController: new AbortController(),
    });

    // A starts and parks mid-stream with the shared permissions set to allow-all.
    const a = executeSubAgent(opts("A"));
    await h.enteredPromises[0];

    // B starts. Without the serialization lock it reads the corrupted
    // (allow-all) state right now and will later "restore" THAT; with the lock
    // it blocks until A releases and only reads the real (restored) state.
    const b = executeSubAgent(opts("B"));

    // Let A finish (restore + release the lock).
    h.release[0]();

    // B reaches the stream only after acquiring the lock (post-A) when serialized.
    await h.enteredPromises[1];
    h.release[1]();

    await Promise.all([a, b]);

    // Main-agent permissions must end up restored to the original policy, not
    // the subagent's allow-all. Fails before the fix (final state = allow-all).
    expect(h.getPolicies()).toEqual(h.MAIN_POLICIES);
    expect(h.getPolicies()).not.toContainEqual({
      tool: "*",
      permission: "allow",
    });
  });
});
