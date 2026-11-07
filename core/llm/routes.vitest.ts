import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  PromptLog,
} from "../index.js";
import { BaseLLM } from "./index.js";
import {
  clearRouteFailures,
  FAILED_ROUTE_COOLDOWN_MS,
  isContextLengthError,
  ROUTE_RETURN_AFTER_IDLE_MS,
  shouldTryNextRoute,
} from "./routes.js";

/** One route: replies, or fails with the given error before replying. */
class RouteLLM extends BaseLLM {
  static providerName = "test-route";
  calls = 0;
  constructor(
    options: LLMOptions,
    public fail?: unknown,
    private readonly failAfterFirstChunk = false,
  ) {
    super(options);
    this.templateMessages = undefined;
  }
  protected async *_streamChat(
    _messages: ChatMessage[],
    _signal: AbortSignal,
    _options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    this.calls++;
    if (this.fail && !this.failAfterFirstChunk) throw this.fail;
    yield { role: "assistant", content: `from ${this.model}` };
    if (this.fail) throw this.fail;
    yield {
      role: "assistant",
      content: "",
      usage: { promptTokens: 10, completionTokens: 2 },
    };
  }
}

const route = (model: string, fail?: unknown, opts: Partial<LLMOptions> = {}) =>
  new RouteLLM({ model, title: "Claude Sonnet", ...opts }, fail);

async function run(llm: BaseLLM) {
  const chunks: ChatMessage[] = [];
  const gen = llm.streamChat(
    [{ role: "user", content: "hi" }],
    new AbortController().signal,
    {},
    { precompiled: true },
  );
  let next = await gen.next();
  while (!next.done) {
    chunks.push(next.value);
    next = await gen.next();
  }
  return { chunks, log: next.value as PromptLog };
}

function withRoutes(first: RouteLLM, ...others: [string, RouteLLM][]) {
  first.routeName = "bedrock-us";
  first.fallbackRoutes = others.map(([name, llm]) => ({ name, llm }));
  return first;
}

const throttled = Object.assign(new Error("Too many requests"), {
  name: "ThrottlingException",
  $metadata: { httpStatusCode: 429 },
});

describe("routes", () => {
  beforeEach(() => clearRouteFailures());
  afterEach(() => vi.useRealTimers());

  it("prices the usage as the answering route's provider and model", async () => {
    const llm = withRoutes(route("us.sonnet", throttled), [
      "anthropic-work",
      route("claude-sonnet-4-6"),
    ]);
    const { chunks } = await run(llm);
    expect(chunks.find((c) => (c as any).usage)).toMatchObject({
      route: "anthropic-work",
      routeProvider: "test-route",
      routeModel: "claude-sonnet-4-6",
    });
  });

  it("skips an account that failed recently, after a config reload too", async () => {
    vi.useFakeTimers();
    const first = route("us.sonnet", throttled);
    await run(withRoutes(first, ["anthropic-work", route("sonnet")]));
    expect(first.calls).toBe(1);
    // A reload builds new models for the same accounts
    const again = route("us.sonnet", throttled);
    const second = route("sonnet");
    await run(withRoutes(again, ["anthropic-work", second]));
    expect(again.calls).toBe(0);
    expect(second.calls).toBe(1);
    // After the cooldown the account is tried again, and is back
    vi.advanceTimersByTime(FAILED_ROUTE_COOLDOWN_MS + 1);
    const later = route("us.sonnet");
    const { log } = await run(
      withRoutes(later, ["anthropic-work", route("sonnet")]),
    );
    expect(later.calls).toBe(1);
    expect(log.route).toBe("bedrock-us");
  });

  it("goes back to the first route once the conversation has been idle", async () => {
    vi.useFakeTimers();
    const first = route("us.sonnet", throttled);
    const second = route("sonnet");
    const llm = withRoutes(first, ["anthropic-work", second]);
    await run(llm); // fails over
    first.fail = undefined; // the first account recovers
    vi.advanceTimersByTime(60_000);
    expect((await run(llm)).log.route).toBe("anthropic-work"); // stays: cache warm
    vi.advanceTimersByTime(
      Math.max(ROUTE_RETURN_AFTER_IDLE_MS, FAILED_ROUTE_COOLDOWN_MS) + 1,
    );
    expect((await run(llm)).log.route).toBe("bedrock-us"); // idle: back
  });

  it("answers on the first route and names it", async () => {
    const llm = withRoutes(route("us.sonnet"), [
      "anthropic-work",
      route("sonnet"),
    ]);
    expect(llm.routeNames).toEqual(["bedrock-us", "anthropic-work"]);
    const { chunks, log } = await run(llm);
    expect(chunks[0].content).toBe("from us.sonnet");
    expect(chunks.find((c) => (c as any).usage)).toMatchObject({
      route: "bedrock-us",
    });
    expect(log.route).toBe("bedrock-us");
  });

  it("moves on when the first route is throttled, and stays there", async () => {
    const first = route("us.sonnet", throttled);
    const second = route("sonnet");
    const llm = withRoutes(first, ["anthropic-work", second]);
    const { chunks, log } = await run(llm);
    expect(chunks[0].content).toBe("from sonnet");
    expect(log.route).toBe("anthropic-work");
    await run(llm);
    expect(first.calls).toBe(1);
    expect(second.calls).toBe(2);
  });

  it("tells a route with a fallback not to retry its own connection", async () => {
    const first = route("us.sonnet", throttled);
    const second = route("sonnet");
    const llm = withRoutes(first, ["anthropic-work", second]);
    await run(llm);
    expect(first.connectionRetryDelaysMs).toEqual([]);
    expect(second.connectionRetryDelaysMs).toBeUndefined();
  });

  it("does not move on for an error every route would give", async () => {
    const llm = withRoutes(
      route(
        "us.sonnet",
        Object.assign(new Error("tool schema invalid"), { status: 400 }),
      ),
      ["anthropic-work", route("sonnet")],
    );
    await expect(run(llm)).rejects.toThrow("tool schema invalid");
  });

  it("does not move on once part of the reply has arrived", async () => {
    const first = new RouteLLM(
      { model: "us.sonnet", title: "Claude Sonnet" },
      throttled,
      true,
    );
    const second = route("sonnet");
    await expect(
      run(withRoutes(first, ["anthropic-work", second])),
    ).rejects.toThrow("Too many requests");
    expect(second.calls).toBe(0);
  });

  it("a model without routes is unchanged", async () => {
    const llm = route("sonnet");
    expect(llm.routeNames).toBeUndefined();
    const { log } = await run(llm);
    expect(log.route).toBeUndefined();
  });
});

describe("shouldTryNextRoute", () => {
  it("on connection, credential and availability failures", () => {
    for (const e of [
      new TypeError("fetch failed"),
      Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:8083"), {
        code: "ECONNREFUSED",
      }),
      Object.assign(new Error("bad key"), { status: 401 }),
      throttled,
      Object.assign(new Error("The model is not available in this region"), {
        name: "ResourceNotFoundException",
      }),
      Object.assign(new Error("Overloaded"), { status: 529 }),
    ]) {
      expect(shouldTryNextRoute(e, {}, {})).toBe(true);
    }
  });

  it("on a dropped connection after the stream retry wrapped it", () => {
    // What the Windows Sandbox check got from an account that drops packets
    const timedOut = Object.assign(new Error("Request timed out."), {
      name: "APIConnectionTimeoutError",
    });
    const wrapped = new Error(
      "The connection closed before the response arrived (tried 3 times). Check your network or proxy and resubmit. (Request timed out.)",
      { cause: timedOut },
    );
    expect(shouldTryNextRoute(wrapped, {}, {})).toBe(true);
    const refused = new Error("wrapped", {
      cause: Object.assign(new Error("connect"), { code: "ECONNREFUSED" }),
    });
    expect(shouldTryNextRoute(refused, {}, {})).toBe(true);
  });

  it("on a context-length error only when the next window is larger", () => {
    const e = new Error("prompt is too long: 250000 tokens > 200000 maximum");
    expect(isContextLengthError(e)).toBe(true);
    expect(
      shouldTryNextRoute(
        e,
        { contextLength: 200_000 },
        { contextLength: 1_000_000 },
      ),
    ).toBe(true);
    expect(
      shouldTryNextRoute(
        e,
        { contextLength: 200_000 },
        { contextLength: 200_000 },
      ),
    ).toBe(false);
  });

  it("not on a bad request", () => {
    expect(
      shouldTryNextRoute(
        Object.assign(new Error("invalid tool name"), { status: 400 }),
        {},
        {},
      ),
    ).toBe(false);
  });
});
