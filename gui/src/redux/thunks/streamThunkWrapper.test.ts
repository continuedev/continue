import { ModelDescription } from "core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockStore, getEmptyRootState } from "../../util/test/mockStore";
import { streamThunkWrapper } from "./streamThunkWrapper";

const model: ModelDescription = {
  title: "Claude Sonnet",
  model: "claude-sonnet-4-6",
  provider: "bedrock",
  underlyingProviderName: "bedrock",
};

function makeStore() {
  const state = getEmptyRootState();
  state.session.id = "s1";
  state.session.mode = "agent";
  state.config.config = {
    ...state.config.config,
    selectedModelByRole: {
      ...state.config.config.selectedModelByRole,
      chat: model,
    },
  };
  return createMockStore(state);
}

const failures = (store: ReturnType<typeof makeStore>): any[] | undefined =>
  (store.getState() as any).session.promptCache?.failures;

const run = (store: ReturnType<typeof makeStore>, fn: () => Promise<void>) =>
  store.dispatch(streamThunkWrapper(fn) as any) as unknown as Promise<void>;

describe("streamThunkWrapper records failed requests", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("records a throttled request with its status, once, and does not retry it", async () => {
    const store = makeStore();
    const runStream = vi.fn(async () => {
      throw new Error("429 Too Many Requests");
    });
    await run(store, runStream);
    expect(runStream).toHaveBeenCalledTimes(1);
    expect(failures(store)).toEqual([
      expect.objectContaining({
        kind: "throttled",
        status: 429,
        mode: "agent",
        provider: "bedrock",
        model: "claude-sonnet-4-6",
      }),
    ]);
  });

  it("records an AWS throttling error that has no status", async () => {
    const store = makeStore();
    await run(store, async () => {
      throw new Error("ThrottlingException: Too many requests");
    });
    const [f] = failures(store)!;
    expect(f.kind).toBe("throttled");
    expect("status" in f).toBe(false);
  });

  it("records each overloaded attempt, then the success leaves it at that", async () => {
    const store = makeStore();
    let calls = 0;
    const runStream = vi.fn(async () => {
      calls++;
      if (calls < 3) throw new Error("Overloaded");
    });
    const done = run(store, runStream);
    await vi.advanceTimersByTimeAsync(2000 + 4000 + 100);
    await done;
    expect(runStream).toHaveBeenCalledTimes(3);
    expect(failures(store)?.map((f) => f.kind)).toEqual([
      "overloaded",
      "overloaded",
    ]);
  });

  it("records an ordinary error as other", async () => {
    const store = makeStore();
    await run(store, async () => {
      throw new Error("401 invalid x-api-key");
    });
    expect(failures(store)?.map((f) => f.kind)).toEqual(["other"]);
  });

  it("records nothing for a request the user stopped, or for a success", async () => {
    const store = makeStore();
    await run(store, async () => {
      throw new Error("The operation was aborted");
    });
    await run(store, async () => {});
    expect(failures(store)).toBeUndefined();
  });
});
