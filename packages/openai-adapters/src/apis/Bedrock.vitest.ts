import { beforeEach, describe, expect, it } from "vitest";
import { BedrockApi } from "./Bedrock.js";

const calls: Array<string | undefined> = [];
let chainImpl: (p: string | undefined) => Promise<any>;

class TestApi extends BedrockApi {
  protected async credentialChain(profile: string | undefined) {
    calls.push(profile);
    return chainImpl(profile);
  }
}
const make = (env: any = {}, extra: any = {}) =>
  new TestApi({ provider: "bedrock", env, ...extra } as any) as any;

describe("BedrockApi credentials", () => {
  beforeEach(() => {
    calls.length = 0;
    chainImpl = async () => ({ accessKeyId: "k", secretAccessKey: "s" });
  });

  it("passes sessionToken with explicit keys", async () => {
    const api = make({
      accessKeyId: "a",
      secretAccessKey: "b",
      sessionToken: "t",
    });
    expect(await api.getCreds()).toEqual({
      accessKeyId: "a",
      secretAccessKey: "b",
      sessionToken: "t",
    });
    expect(calls).toEqual([]);
  });

  it("uses an explicit profile strictly and adds an SSO hint", async () => {
    chainImpl = async () => {
      throw new Error(
        "The SSO session associated with this profile has expired",
      );
    };
    await expect(make({ profile: "work" }).getCreds()).rejects.toThrow(
      /aws sso login --profile work/,
    );
    expect(calls).toEqual(["work"]);
  });

  it("falls back from legacy 'bedrock' profile to the default chain", async () => {
    chainImpl = async (p) => {
      if (p === "bedrock") throw new Error("nope");
      return { accessKeyId: "d", secretAccessKey: "s" };
    };
    expect((await make().getCreds()).accessKeyId).toBe("d");
    expect(calls).toEqual(["bedrock", undefined]);
  });

  it("reads AWS_BEARER_TOKEN_BEDROCK only when nothing else is configured", () => {
    process.env.AWS_BEARER_TOKEN_BEDROCK = "env";
    try {
      expect(make().resolveApiKey()).toBe("env");
      expect(make({ profile: "p" }).resolveApiKey()).toBeUndefined();
      expect(make({}, { apiKey: "cfg" }).resolveApiKey()).toBe("cfg");
    } finally {
      delete process.env.AWS_BEARER_TOKEN_BEDROCK;
    }
  });

  it("builds service tier / latency / guardrail fields from env", () => {
    const api = make({
      serviceTier: "flex",
      latency: "optimized",
      guardrailIdentifier: "gr-1",
      guardrailVersion: "2",
    });
    expect(api.extraConverseFields()).toEqual({
      serviceTier: { type: "flex" },
      performanceConfig: { latency: "optimized" },
      guardrailConfig: { guardrailIdentifier: "gr-1", guardrailVersion: "2" },
    });
    expect(make().extraConverseFields()).toEqual({});
  });
});

describe("BedrockApi networking (requestOptions)", () => {
  const SAVED = { ...process.env };
  const clear = () => {
    for (const k of [
      "HTTPS_PROXY",
      "https_proxy",
      "HTTP_PROXY",
      "http_proxy",
      "NO_PROXY",
      "no_proxy",
    ]) {
      delete process.env[k];
    }
  };
  afterEach(() => {
    process.env = { ...SAVED };
  });

  const handlerOf = async (config: any) => {
    const api = new TestApi({
      provider: "bedrock",
      apiKey: "k",
      ...config,
    } as any) as any;
    const client = await api.getClient();
    return client.config.requestHandler;
  };

  it("keeps the SDK's default handler when nothing is configured (Linux)", async () => {
    clear();
    const handler = await handlerOf({});
    if (process.platform === "linux") {
      expect(handler.constructor.name).not.toBe("NodeHttpHandler");
    }
  });

  it.each([
    ["caBundlePath", { caBundlePath: "/does/not/matter.pem" }],
    ["useSystemCa", { useSystemCa: true }],
    ["verifySsl=false", { verifySsl: false }],
    ["proxy", { proxy: "http://proxy.corp:3128" }],
  ])("uses a custom handler for %s", async (_name, requestOptions) => {
    clear();
    const handler = await handlerOf({ requestOptions });
    expect(handler.constructor.name).toBe("NodeHttpHandler");
  });

  it("picks up HTTPS_PROXY from the environment", async () => {
    clear();
    process.env.HTTPS_PROXY = "http://envproxy:8080";
    const handler = await handlerOf({});
    expect(handler.constructor.name).toBe("NodeHttpHandler");
  });

  it("does not proxy hosts listed in noProxy", async () => {
    clear();
    const handler = await handlerOf({
      requestOptions: { proxy: "http://proxy:1", noProxy: ["*.amazonaws.com"] },
    });
    expect(handler.constructor.name).not.toBe("NodeHttpHandler");
  });
});

describe("BedrockApi usage", () => {
  const events = [
    { contentBlockDelta: { delta: { text: "Hello" } } },
    { contentBlockDelta: { delta: { text: " there" } } },
    {
      metadata: {
        usage: {
          inputTokens: 12,
          outputTokens: 34,
          cacheReadInputTokens: 5000,
          cacheWriteInputTokens: 700,
        },
      },
    },
  ];

  const makeStreaming = (stream: any[]) => {
    class StreamApi extends TestApi {
      async getClient() {
        return {
          send: async () => ({
            stream: (async function* () {
              for (const e of stream) yield e;
            })(),
          }),
        } as any;
      }
    }
    return new StreamApi({ provider: "bedrock", env: {} } as any);
  };

  const body = {
    model: "anthropic.claude-sonnet-4-6",
    messages: [{ role: "user", content: "hi" }],
    stream: true,
  } as any;

  it("streams a final usage chunk with the cache counts", async () => {
    const api = makeStreaming(events);
    const chunks: any[] = [];
    for await (const c of api.chatCompletionStream(
      body,
      new AbortController().signal,
    )) {
      chunks.push(c);
    }
    const usageChunks = chunks.filter((c) => c.usage);
    expect(usageChunks).toHaveLength(1);
    expect(usageChunks[0].choices).toEqual([]);
    expect(usageChunks[0].usage).toEqual({
      prompt_tokens: 12,
      completion_tokens: 34,
      total_tokens: 46,
      prompt_tokens_details: {
        cached_tokens: 5000,
        cache_read_tokens: 5000,
        cache_write_tokens: 700,
      },
    });
    // The usage chunk comes after the text
    expect(chunks[chunks.length - 1]).toBe(usageChunks[0]);
  });

  it("returns the usage from a non-streaming call", async () => {
    const api = makeStreaming(events);
    const res = await api.chatCompletionNonStream(
      { ...body, stream: false },
      new AbortController().signal,
    );
    expect(res.choices[0].message.content).toBe("Hello there");
    expect(res.usage).toMatchObject({
      prompt_tokens: 12,
      completion_tokens: 34,
      prompt_tokens_details: { cache_read_tokens: 5000 },
    });
  });

  it("emits no usage chunk when the stream has no metadata", async () => {
    const api = makeStreaming(events.slice(0, 2));
    const chunks: any[] = [];
    for await (const c of api.chatCompletionStream(
      body,
      new AbortController().signal,
    )) {
      chunks.push(c);
    }
    expect(chunks.filter((c) => c.usage)).toHaveLength(0);
    const res = await api.chatCompletionNonStream(
      { ...body, stream: false },
      new AbortController().signal,
    );
    expect(res.usage).toBeUndefined();
  });

  it("counts missing cache fields as zero", async () => {
    const api = makeStreaming([
      { metadata: { usage: { inputTokens: 3, outputTokens: 4 } } },
    ]);
    const res = await api.chatCompletionNonStream(
      { ...body, stream: false },
      new AbortController().signal,
    );
    expect(res.usage).toEqual({
      prompt_tokens: 3,
      completion_tokens: 4,
      total_tokens: 7,
      prompt_tokens_details: {
        cached_tokens: 0,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
      },
    });
  });
});

describe("BedrockApi request ID", () => {
  const stream = [
    { contentBlockDelta: { delta: { text: "Hi" } } },
    { metadata: { usage: { inputTokens: 1, outputTokens: 1 } } },
  ];
  const withMetadata = (metadata: any) => {
    class IdApi extends TestApi {
      async getClient() {
        return {
          send: async () => ({
            $metadata: metadata,
            stream: (async function* () {
              for (const e of stream) yield e;
            })(),
          }),
        } as any;
      }
    }
    return new IdApi({ provider: "bedrock", env: {} } as any);
  };
  const body = {
    model: "anthropic.claude-sonnet-4-6",
    messages: [{ role: "user", content: "hi" }],
    stream: true,
  } as any;

  it("puts Bedrock's request ID on every streamed chunk", async () => {
    const api = withMetadata({ requestId: "req-abc-123" });
    const ids: string[] = [];
    for await (const c of api.chatCompletionStream(
      body,
      new AbortController().signal,
    )) {
      ids.push(c.id);
    }
    // a text chunk and the usage chunk
    expect(ids).toEqual(["req-abc-123", "req-abc-123"]);
  });

  it("uses it as the ID of a non-streaming response", async () => {
    const api = withMetadata({ requestId: "req-abc-123" });
    const res = await api.chatCompletionNonStream(
      { ...body, stream: false },
      new AbortController().signal,
    );
    expect(res.id).toBe("req-abc-123");
  });

  it("falls back to a generated ID when Bedrock sends none", async () => {
    const api = withMetadata(undefined);
    const chunks: any[] = [];
    for await (const c of api.chatCompletionStream(
      body,
      new AbortController().signal,
    )) {
      chunks.push(c);
    }
    expect(chunks.map((c) => c.id)).toEqual(["", ""]);
    const res = await api.chatCompletionNonStream(
      { ...body, stream: false },
      new AbortController().signal,
    );
    expect(res.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("BedrockApi cache points", () => {
  const tool = {
    type: "function",
    function: { name: "read", description: "d", parameters: {} },
  };
  const messages = [
    { role: "system", content: "be brief" },
    { role: "user", content: "one" },
    { role: "assistant", content: "ok" },
    { role: "user", content: "two" },
    { role: "assistant", content: "ok" },
    { role: "user", content: "three" },
  ];
  const convert = (config: any = {}, extra: any = {}) =>
    (
      new TestApi({ provider: "bedrock", env: {}, ...config } as any) as any
    )._convertBody({
      model: "anthropic.claude-sonnet-4-6",
      messages: JSON.parse(JSON.stringify(messages)),
      tools: [tool],
      ...extra,
    });
  const points = (blocks: any[] | undefined) =>
    (blocks ?? []).filter((b) => b.cachePoint).length;
  const userPoints = (body: any) =>
    body.messages
      .filter((m: any) => m.role === "user")
      .map((m: any) => points(m.content));

  it("sends no cache points when nothing is configured", () => {
    const body = convert();
    expect(points(body.system)).toBe(0);
    expect(points(body.toolConfig.tools)).toBe(0);
    expect(userPoints(body)).toEqual([0, 0, 0]);
    expect(JSON.stringify(body)).not.toContain("SID:");
  });

  it("promptCaching: true caches tools, system and the last two user messages", () => {
    const body = convert({ promptCaching: true });
    expect(points(body.system)).toBe(1);
    expect(body.system[1]).toEqual({ cachePoint: { type: "default" } });
    expect(points(body.toolConfig.tools)).toBe(1);
    expect(body.toolConfig.tools.at(-1)).toEqual({
      cachePoint: { type: "default" },
    });
    // four cache points in all, the most Bedrock allows
    expect(userPoints(body)).toEqual([0, 1, 1]);
  });

  it("adds no per-process marker, so another process reads the same prefix", () => {
    const body = convert({ promptCaching: true });
    const texts = body.messages.map((m: any) =>
      m.content.map((b: any) => b.text ?? "").join(""),
    );
    expect(texts).toEqual(["one", "ok", "two", "ok", "three"]);
    expect(JSON.stringify(body)).not.toContain("SID:");
  });

  it("keeps the first message's bytes the same when the conversation grows", () => {
    const short = convert({ promptCaching: true });
    const long = convert(
      { promptCaching: true },
      {
        messages: [
          ...messages,
          { role: "assistant", content: "ok" },
          { role: "user", content: "four" },
        ],
      },
    );
    expect(JSON.stringify(long.messages[0])).toBe(
      JSON.stringify(short.messages[0]),
    );
  });

  it("promptCaching: false wins over cacheBehavior", () => {
    const body = convert({
      promptCaching: false,
      cacheBehavior: { cacheSystemMessage: true, cacheConversation: true },
    });
    expect(points(body.system)).toBe(0);
    expect(userPoints(body)).toEqual([0, 0, 0]);
  });

  it("cacheBehavior alone switches on system and conversation, not tools", () => {
    const body = convert({
      cacheBehavior: { cacheSystemMessage: true, cacheConversation: true },
    });
    expect(points(body.system)).toBe(1);
    expect(points(body.toolConfig.tools)).toBe(0);
    expect(userPoints(body)).toEqual([0, 1, 1]);
  });

  it("cacheSystemMessage with no system message adds nothing", () => {
    const body = convert(
      { cacheBehavior: { cacheSystemMessage: true } },
      { messages: messages.slice(1) },
    );
    expect(body.system).toBeUndefined();
  });

  it("does not cache tools when there are none", () => {
    const body = convert({ promptCaching: true }, { tools: undefined });
    expect(body.toolConfig).toBeUndefined();
  });
});

describe("BedrockApi cache points on non-Claude models", () => {
  const body = (model: string) =>
    (
      new TestApi({
        provider: "bedrock",
        env: {},
        promptCaching: true,
      } as any) as any
    )._convertBody({
      model,
      messages: [
        { role: "system", content: "be brief" },
        { role: "user", content: "hi" },
      ],
      tools: [
        {
          type: "function",
          function: { name: "read", description: "d", parameters: {} },
        },
      ],
    });

  it.each([
    "us.openai.gpt-6.1-sol",
    "us.xai.grok-4.7",
    "us.amazon.nova-premier-v1:0",
    "us.amazon.nova-2-pro-v1:0",
  ])("sends no cachePoint to %s even with promptCaching on", (model) => {
    expect(JSON.stringify(body(model))).not.toContain("cachePoint");
    expect(JSON.stringify(body(model))).not.toContain("SID:");
  });

  // The AWS table lists these Nova models with checkpoints in `system` and
  // `messages` only; a cache point in the tool list is refused (seen live).
  it.each([
    "us.amazon.nova-2-lite-v1:0",
    "amazon.nova-2-lite-v1:0",
    "us.amazon.nova-pro-v1:0",
    "amazon.nova-lite-v1:0",
    "amazon.nova-micro-v1:0",
  ])("caches the system prompt and messages, not the tools, on %s", (model) => {
    const b = body(model);
    expect(b.system.at(-1)).toEqual({ cachePoint: { type: "default" } });
    expect(JSON.stringify(b.toolConfig)).not.toContain("cachePoint");
    const user = b.messages.find((m: any) => m.role === "user");
    expect(user.content.at(-1)).toEqual({ cachePoint: { type: "default" } });
    expect(JSON.stringify(b.messages)).not.toContain("SID:");
  });

  // Seen live on 2026-11-08: "#/messages/2/content/0: extraneous key
  // [cachePoint]" at the second request of every multi-turn Nova run, when
  // the newest user message held only tool results. Checked the same day:
  // Nova takes the point after a text block that follows the toolResult, and
  // on an earlier text-only message; Claude takes it after the toolResult.
  describe("next to tool results", () => {
    const call = (id: string) => ({
      id,
      type: "function",
      function: { name: "read", arguments: "{}" },
    });
    const history = [
      { role: "system", content: "be brief" },
      { role: "user", content: "fix it" },
      { role: "assistant", content: "", tool_calls: [call("a")] },
      { role: "tool", content: "out a", tool_call_id: "a" },
      { role: "assistant", content: "", tool_calls: [call("b")] },
      { role: "tool", content: "out b", tool_call_id: "b" },
    ];
    const convert = (model: string, messages: unknown[]) =>
      (
        new TestApi({
          provider: "bedrock",
          env: {},
          promptCaching: true,
        } as any) as any
      )._convertBody({
        model,
        messages,
        tools: [
          {
            type: "function",
            function: { name: "read", description: "d", parameters: {} },
          },
        ],
      }).messages as any[];
    const pointsAt = (messages: any[]) =>
      messages.flatMap((m, i) =>
        m.content.some((c: any) => c.cachePoint) ? [i] : [],
      );

    it("gives Nova no cache point in a tool-result message", () => {
      const messages = convert("us.amazon.nova-2-lite-v1:0", history);
      expect(messages.map((m) => m.role)).toEqual([
        "user",
        "assistant",
        "user",
        "assistant",
        "user",
      ]);
      expect(pointsAt(messages)).toEqual([0]);
      expect(JSON.stringify(messages)).not.toMatch(/toolResult[^}]*cachePoint/);
    });

    it("puts Nova's point right after a text block that follows a tool result", () => {
      const messages = convert("us.amazon.nova-2-lite-v1:0", [
        ...history,
        { role: "user", content: "also check the tests" },
      ]);
      const last = messages.at(-1).content;
      expect(last.map((c: any) => Object.keys(c)[0])).toEqual([
        "toolResult",
        "text",
        "cachePoint",
      ]);
      expect(pointsAt(messages)).toEqual([0, 4]);
    });

    it("keeps Claude's point after the tool result", () => {
      const messages = convert("anthropic.claude-sonnet-4-6", history);
      expect(pointsAt(messages)).toEqual([2, 4]);
      expect(messages.at(-1).content.at(-1)).toEqual({
        cachePoint: { type: "default" },
      });
    });
  });

  it("never sends a ttl to Nova, which takes only the 5-minute default", () => {
    const b = (
      new TestApi({
        provider: "bedrock",
        env: {},
        promptCaching: true,
        cacheBehavior: { ttl: "1h" },
      } as any) as any
    )._convertBody({
      model: "us.amazon.nova-2-lite-v1:0",
      messages: [
        { role: "system", content: "be brief" },
        { role: "user", content: "hi" },
      ],
    });
    expect(JSON.stringify(b)).toContain("cachePoint");
    expect(JSON.stringify(b)).not.toContain("ttl");
  });

  it.each([
    "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    "anthropic.claude-sonnet-4-6",
    "global.anthropic.claude-sonnet-5-5",
  ])("still sends cachePoint to %s", (model) => {
    expect(JSON.stringify(body(model))).toContain("cachePoint");
  });
});

describe("BedrockApi when the call is refused", () => {
  const AWS_TEXT =
    "anthropic.claude-haiku-5-5 is not available for this account. You can explore other available models on Amazon Bedrock.";

  const refusedWith = (name: string, message: string) => {
    class RefusedApi extends BedrockApi {
      async getClient() {
        return {
          send: async () => {
            throw Object.assign(new Error(message), { name });
          },
        } as any;
      }
    }
    return new RefusedApi({
      provider: "bedrock",
      env: { region: "us-east-1", crossRegionInference: "us" },
    } as any);
  };

  const stream = async (api: BedrockApi) => {
    const chunks = api.chatCompletionStream(
      {
        model: "anthropic.claude-haiku-5-5",
        messages: [{ role: "user", content: "hi" }],
        stream: true,
      } as any,
      new AbortController().signal,
    );
    for await (const _ of chunks) {
      // the first step throws
    }
  };

  it("explains a model the account has not been given, naming the ID it sent", async () => {
    const error = await stream(
      refusedWith("AccessDeniedException", AWS_TEXT),
    ).catch((e: Error) => e);
    const message = (error as Error).message;
    expect(message).toContain("refused us.anthropic.claude-haiku-5-5");
    expect(message).toContain("use-case form");
    expect(message.endsWith(`AWS said: ${AWS_TEXT}`)).toBe(true);
    expect(message).not.toContain("Error processing Bedrock stream");
  });

  it("keeps the existing message for another AccessDenied refusal", async () => {
    const text = "User: dev is not authorized to perform: bedrock:InvokeModel";
    await expect(
      stream(refusedWith("AccessDeniedException", text)),
    ).rejects.toThrow(new Error(`Error processing Bedrock stream: ${text}`));
  });
});

describe("BedrockApi request shape per model family (probed live 2026-11-08)", () => {
  const convert = (model: string, extra: any = {}, env: any = {}) =>
    (new TestApi({ provider: "bedrock", env } as any) as any)._convertBody({
      model,
      messages: [{ role: "user", content: "hi" }],
      ...extra,
    });
  const haiku45 = "us.anthropic.claude-haiku-4-5-20251001-v1:0";
  const nova2 = "us.amazon.nova-2-lite-v1:0";
  const tools = [
    {
      type: "function",
      function: { name: "read", description: "d", parameters: {} },
    },
  ];

  it("sends Claude temperature or top_p, never both", () => {
    const both = convert(haiku45, { temperature: 0.5, top_p: 0.9 });
    expect(both.inferenceConfig.temperature).toBe(0.5);
    expect(both.inferenceConfig.topP).toBeUndefined();
    const topOnly = convert(haiku45, { top_p: 0.9 });
    expect(topOnly.inferenceConfig.topP).toBe(0.9);
    expect(topOnly.inferenceConfig.temperature).toBeUndefined();
    expect(
      convert(nova2, { temperature: 0.5, top_p: 0.9 }).inferenceConfig,
    ).toMatchObject({ temperature: 0.5, topP: 0.9 });
  });

  it("turns Claude thinking on from reasoning_effort and drops the sampling fields", () => {
    const body = convert(haiku45, {
      reasoning_effort: "low",
      temperature: 0.5,
      top_p: 0.9,
      max_tokens: 2048,
    });
    expect(body.additionalModelRequestFields).toEqual({
      thinking: { type: "enabled", budget_tokens: 1024 },
    });
    expect(body.inferenceConfig.temperature).toBeUndefined();
    expect(body.inferenceConfig.topP).toBeUndefined();
    expect(body.inferenceConfig.maxTokens).toBe(2048);
  });

  it("sends nothing about reasoning when the body says nothing", () => {
    expect(convert(haiku45)).not.toHaveProperty("additionalModelRequestFields");
    expect(convert("qwen.qwen3-32b-v1:0")).not.toHaveProperty(
      "additionalModelRequestFields",
    );
  });

  it("turns Nova 2 reasoning on with reasoningConfig, and omits maxTokens at high", () => {
    const medium = convert(nova2, {
      reasoning_effort: "medium",
      max_tokens: 900,
    });
    expect(medium.additionalModelRequestFields).toEqual({
      reasoningConfig: { type: "enabled", maxReasoningEffort: "medium" },
    });
    expect(medium.inferenceConfig.maxTokens).toBe(900);
    const high = convert(nova2, { reasoning_effort: "high", max_tokens: 900 });
    expect(
      high.additionalModelRequestFields.reasoningConfig.maxReasoningEffort,
    ).toBe("high");
    expect(high.inferenceConfig.maxTokens).toBeUndefined();
  });

  it("sends Qwen3 and DeepSeek V3.2 reasoning_effort, none only for an explicit none", () => {
    expect(
      convert("qwen.qwen3-32b-v1:0", { reasoning_effort: "xhigh" })
        .additionalModelRequestFields,
    ).toEqual({ reasoning_effort: "high" });
    expect(
      convert("deepseek.v3.2", { reasoning_effort: "none" })
        .additionalModelRequestFields,
    ).toEqual({ reasoning_effort: "none" });
  });

  it.each([
    "us.deepseek.r1-v1:0",
    "us.amazon.nova-pro-v1:0",
    "us.meta.llama3-3-70b-instruct-v1:0",
    "mistral.mistral-large-3-675b-instruct",
  ])("sends %s no reasoning field even when asked", (model) => {
    const body = convert(model, { reasoning_effort: "high", max_tokens: 900 });
    expect(body).not.toHaveProperty("additionalModelRequestFields");
    expect(body.inferenceConfig.maxTokens).toBe(900);
  });

  it("asks for toolChoice auto whenever tools are sent", () => {
    expect(convert(nova2, { tools }).toolConfig.toolChoice).toEqual({
      auto: {},
    });
    expect(convert(nova2).toolConfig).toBeUndefined();
  });
});

describe("BedrockApi stream events", () => {
  const signal = new AbortController().signal;

  function streaming(
    events: any[],
    env: any = {},
    sends: Array<(input: any) => void> = [],
  ) {
    const sent: any[] = [];
    class StreamApi extends TestApi {
      async getClient() {
        return {
          send: async (command: any) => {
            const input = command.input;
            sent.push(JSON.parse(JSON.stringify(input)));
            sends[sent.length - 1]?.(input);
            return {
              $metadata: { requestId: "req-1" },
              stream: (async function* () {
                for (const e of events) yield e;
              })(),
            };
          },
        } as any;
      }
    }
    const api = new StreamApi({ provider: "bedrock", env } as any);
    const collect = async (model: string, extra: any = {}) => {
      const chunks: any[] = [];
      for await (const c of api.chatCompletionStream(
        {
          model,
          messages: [{ role: "user", content: "hi" }],
          stream: true,
          ...extra,
        } as any,
        signal,
      )) {
        chunks.push(c);
      }
      return chunks;
    };
    const nonStream = (model: string, extra: any = {}) =>
      api.chatCompletionNonStream(
        {
          model,
          messages: [{ role: "user", content: "hi" }],
          stream: false,
          ...extra,
        } as any,
        signal,
      );
    return { collect, nonStream, sent };
  }
  const deltas = (chunks: any[]) =>
    chunks.map((c) => c.choices[0]?.delta).filter(Boolean);

  it("emits reasoning text as reasoning_content and the signature in reasoning_details", async () => {
    const { collect } = streaming([
      {
        contentBlockDelta: { delta: { reasoningContent: { text: "Let me" } } },
      },
      { contentBlockDelta: { delta: { reasoningContent: { text: " see" } } } },
      {
        contentBlockDelta: {
          delta: { reasoningContent: { signature: "sig" } },
        },
      },
      { contentBlockDelta: { delta: { text: "4" } } },
    ]);
    const d = deltas(await collect("us.anthropic.claude-haiku-4-5"));
    expect(d[0]).toMatchObject({ reasoning_content: "Let me" });
    expect(d[1]).toMatchObject({ reasoning_content: " see" });
    expect(d[2]).toMatchObject({ reasoning_details: [{ signature: "sig" }] });
    expect(d[3]).toMatchObject({ content: "4" });
  });

  it("carries redacted thinking as an encrypted reasoning detail, Nova's placeholder included", async () => {
    const bytes = new Uint8Array([1, 2, 250]);
    const { collect } = streaming([
      {
        contentBlockDelta: {
          delta: { reasoningContent: { redactedContent: bytes } },
        },
      },
      {
        contentBlockDelta: {
          delta: { reasoningContent: { text: "[REDACTED]." } },
        },
      },
    ]);
    const claude = deltas(await collect("us.anthropic.claude-haiku-4-5"));
    expect(claude[0].reasoning_details).toEqual([
      {
        type: "reasoning.encrypted",
        data: Buffer.from(bytes).toString("base64"),
      },
    ]);
    // On Claude the placeholder text would be a real thought
    expect(claude[1]).toMatchObject({ reasoning_content: "[REDACTED]." });
    const nova = deltas(await collect("us.amazon.nova-2-lite-v1:0"));
    expect(nova[1].reasoning_content).toBeUndefined();
    expect(nova[1].reasoning_details).toEqual([
      { type: "reasoning.encrypted", data: "[REDACTED]." },
    ]);
  });

  it("maps the stop reason to finish_reason on an empty final delta", async () => {
    const events = (stopReason: string) => [
      { contentBlockDelta: { delta: { text: "partial" } } },
      { messageStop: { stopReason } },
      { metadata: { usage: { inputTokens: 5, outputTokens: 40 } } },
    ];
    for (const [stop, finish] of [
      ["max_tokens", "length"],
      ["tool_use", "tool_calls"],
      ["end_turn", "stop"],
      ["stop_sequence", "stop"],
      ["content_filtered", "content_filter"],
    ]) {
      const chunks = await streaming(events(stop)).collect(
        "us.anthropic.claude-haiku-4-5",
      );
      const last = chunks.filter((c) => c.choices.length > 0).at(-1);
      expect(last.choices[0].delta).toEqual({});
      expect(last.choices[0].finish_reason).toBe(finish);
      // the usage chunk still comes last
      expect(chunks.at(-1).usage).toBeDefined();
    }
  });

  it("reports truncation from a non-streaming call", async () => {
    const res = await streaming([
      { contentBlockDelta: { delta: { text: "partial" } } },
      { messageStop: { stopReason: "max_tokens" } },
    ]).nonStream("us.anthropic.claude-haiku-4-5");
    expect(res.choices[0].finish_reason).toBe("length");
    expect(res.choices[0].message.content).toBe("partial");
  });

  it("numbers each tool call and collects them in a non-streaming call", async () => {
    const toolEvents = [
      { contentBlockDelta: { delta: { text: "Reading." } } },
      {
        contentBlockStart: {
          start: { toolUse: { toolUseId: "t1", name: "read" } },
        },
      },
      { contentBlockDelta: { delta: { toolUse: { input: '{"path":' } } } },
      { contentBlockDelta: { delta: { toolUse: { input: '"a.txt"}' } } } },
      { contentBlockStop: {} },
      {
        contentBlockStart: {
          start: { toolUse: { toolUseId: "t2", name: "read" } },
        },
      },
      {
        contentBlockDelta: {
          delta: { toolUse: { input: '{"path":"b.txt"}' } },
        },
      },
      { contentBlockStop: {} },
      { messageStop: { stopReason: "tool_use" } },
      { metadata: { usage: { inputTokens: 5, outputTokens: 40 } } },
    ];
    const { collect, nonStream } = streaming(toolEvents);
    const indexes = deltas(await collect("us.amazon.nova-2-lite-v1:0"))
      .flatMap((d) => d.tool_calls ?? [])
      .map((t) => t.index);
    expect(indexes).toEqual([0, 0, 0, 1, 1]);

    const res = await nonStream("us.amazon.nova-2-lite-v1:0");
    expect(res.choices[0].finish_reason).toBe("tool_calls");
    expect(res.choices[0].message.content).toBe("Reading.");
    expect(res.choices[0].message.tool_calls).toEqual([
      {
        id: "t1",
        type: "function",
        function: { name: "read", arguments: '{"path":"a.txt"}' },
      },
      {
        id: "t2",
        type: "function",
        function: { name: "read", arguments: '{"path":"b.txt"}' },
      },
    ]);
    expect(res.usage).toMatchObject({ completion_tokens: 40 });
  });

  it("drops DeepSeek V3.2's leaked tool-call marker, even split across deltas", async () => {
    const { collect } = streaming([
      { contentBlockDelta: { delta: { text: "I will echo it." } } },
      { contentBlockDelta: { delta: { text: "<\uFF5CDS" } } },
      { contentBlockDelta: { delta: { text: "ML\uFF5Cfunction_calls" } } },
      { contentBlockStop: {} },
      {
        contentBlockStart: {
          start: { toolUse: { toolUseId: "t1", name: "echo" } },
        },
      },
      { contentBlockDelta: { delta: { toolUse: { input: "{}" } } } },
      { contentBlockStop: {} },
    ]);
    const d = deltas(await collect("deepseek.v3.2"));
    expect(d.map((x) => x.content ?? "").join("")).toBe("I will echo it.");
    expect(d.some((x) => x.tool_calls?.[0]?.function?.name === "echo")).toBe(
      true,
    );
    // Another model's angle bracket is left alone
    const plain = deltas(
      await streaming([
        { contentBlockDelta: { delta: { text: "a <" } } },
        { contentBlockDelta: { delta: { text: " b" } } },
        { contentBlockStop: {} },
      ]).collect("deepseek.v3.2"),
    );
    expect(plain.map((x) => x.content).join("")).toBe("a < b");
  });

  it("retries once without the auto prefix when Bedrock calls the ID invalid, and remembers", async () => {
    const refuse = () => {
      throw new Error(
        "ValidationException: The provided model identifier is invalid.",
      );
    };
    const { collect, sent } = streaming(
      [{ contentBlockDelta: { delta: { text: "ok" } } }],
      { region: "us-east-1", crossRegionInference: "auto" },
      [refuse],
    );
    const model = "qwen.qwen3-coder-30b-a3b-v1:0";
    expect(deltas(await collect(model))[0].content).toBe("ok");
    expect(sent.map((i) => i.modelId)).toEqual([`us.${model}`, model]);
    await collect(model);
    expect(sent.at(-1).modelId).toBe(model);
  });

  it("does not second-guess an explicit prefix", async () => {
    const { collect } = streaming(
      [],
      { region: "us-east-1", crossRegionInference: "us" },
      [
        () => {
          throw new Error("The provided model identifier is invalid.");
        },
      ],
    );
    await expect(
      collect("mistral.mistral-large-3-675b-instruct"),
    ).rejects.toThrow(/model identifier is invalid/);
  });
});

describe("BedrockApi tools through Converse (Llama 4, Qwen3 32B; probed live 2026-11-08)", () => {
  const signal = new AbortController().signal;
  const tools = [
    {
      type: "function",
      function: { name: "Read", parameters: { type: "object" } },
    },
  ];
  const converseReply = {
    $metadata: { requestId: "req-c" },
    output: {
      message: {
        role: "assistant",
        content: [
          { text: "Reading it." },
          {
            toolUse: {
              toolUseId: "tooluse_1",
              name: "Read",
              input: { filepath: "a.ts" },
            },
          },
          {
            toolUse: {
              toolUseId: "tooluse_2",
              name: "Read",
              input: { filepath: "b.ts" },
            },
          },
        ],
      },
    },
    stopReason: "tool_use",
    usage: { inputTokens: 12, outputTokens: 34 },
  };

  /** A client whose send answers Converse with `reply` and ConverseStream with `events`, or throws. */
  function client(reply: any, events: any[] = [], streamError?: Error) {
    const sent: { command: string; input: any }[] = [];
    class RouteApi extends TestApi {
      async getClient() {
        return {
          send: async (command: any) => {
            sent.push({
              command: command.constructor.name,
              input: JSON.parse(JSON.stringify(command.input)),
            });
            if (command.constructor.name === "ConverseCommand") return reply;
            if (streamError) throw streamError;
            return {
              $metadata: { requestId: "req-s" },
              stream: (async function* () {
                for (const e of events) yield e;
              })(),
            };
          },
        } as any;
      }
    }
    const api = new RouteApi({ provider: "bedrock", env: {} } as any);
    const collect = async (model: string, extra: any = {}) => {
      const chunks: any[] = [];
      for await (const c of api.chatCompletionStream(
        {
          model,
          messages: [{ role: "user", content: "hi" }],
          stream: true,
          ...extra,
        } as any,
        signal,
      )) {
        chunks.push(c);
      }
      return chunks;
    };
    return { collect, sent };
  }

  it("sends a Llama 4 request with tools through Converse and yields the whole reply as chunks", async () => {
    const { collect, sent } = client(converseReply);
    const chunks = await collect("us.meta.llama4-maverick-17b-instruct-v1:0", {
      tools,
    });
    expect(sent.map((s) => s.command)).toEqual(["ConverseCommand"]);
    expect(sent[0].input.toolConfig.tools).toHaveLength(1);
    const deltas = chunks.map((c) => c.choices[0]?.delta).filter(Boolean);
    expect(deltas[0]).toMatchObject({ content: "Reading it." });
    // each toolUse block at its own index, arguments as a JSON string
    expect(deltas[1].tool_calls[0]).toMatchObject({
      index: 0,
      id: "tooluse_1",
      function: { name: "Read", arguments: '{"filepath":"a.ts"}' },
    });
    expect(deltas[2].tool_calls[0]).toMatchObject({
      index: 1,
      id: "tooluse_2",
      function: { arguments: '{"filepath":"b.ts"}' },
    });
    // then the finish_reason chunk from stopReason and the usage chunk
    const finish = chunks.filter((c) => c.choices.length > 0).at(-1);
    expect(finish.choices[0].delta).toEqual({});
    expect(finish.choices[0].finish_reason).toBe("tool_calls");
    expect(chunks.at(-1).usage).toMatchObject({
      prompt_tokens: 12,
      completion_tokens: 34,
    });
    expect(chunks[0].id).toBe("req-c");
  });

  it("streams a Llama 4 request without tools as usual", async () => {
    const { collect, sent } = client(converseReply, [
      { contentBlockDelta: { delta: { text: "hi" } } },
    ]);
    await collect("us.meta.llama4-scout-17b-instruct-v1:0");
    expect(sent.map((s) => s.command)).toEqual(["ConverseStreamCommand"]);
  });

  it("routes Qwen3 32B tool requests the same way (its streamed tool input is truncated)", async () => {
    const { collect, sent } = client(converseReply);
    await collect("qwen.qwen3-32b-v1:0", { tools });
    expect(sent.map((s) => s.command)).toEqual(["ConverseCommand"]);
  });

  it("retries once through Converse when ConverseStream refuses tools, and remembers the model", async () => {
    const refusal = new Error(
      "This model does not support tool use in streaming mode.".replace(
        "does not",
        "doesn't",
      ),
    );
    const first = client(converseReply, [], refusal);
    const chunks = await first.collect("mistral.some-future-model", { tools });
    expect(first.sent.map((s) => s.command)).toEqual([
      "ConverseStreamCommand",
      "ConverseCommand",
    ]);
    expect(chunks.some((c) => c.choices[0]?.delta?.tool_calls?.length)).toBe(
      true,
    );
    // the next request with tools goes straight to Converse
    const second = client(converseReply);
    await second.collect("mistral.some-future-model", { tools });
    expect(second.sent.map((s) => s.command)).toEqual(["ConverseCommand"]);
  });

  it("does not retry other errors", async () => {
    const other = client(converseReply, [], new Error("ThrottlingException"));
    await expect(
      other.collect("mistral.other-model", { tools }),
    ).rejects.toThrow(/ThrottlingException/);
    expect(other.sent.map((s) => s.command)).toEqual(["ConverseStreamCommand"]);
  });
});

describe("BedrockApi Nova <thinking> tags (Nova Pro, seen live 2026-11-08)", () => {
  const signal = new AbortController().signal;

  function streaming(events: any[]) {
    class StreamApi extends TestApi {
      async getClient() {
        return {
          send: async () => ({
            $metadata: { requestId: "req-1" },
            stream: (async function* () {
              for (const e of events) yield e;
            })(),
          }),
        } as any;
      }
    }
    const api = new StreamApi({ provider: "bedrock", env: {} } as any);
    return async (model: string) => {
      const chunks: any[] = [];
      for await (const c of api.chatCompletionStream(
        {
          model,
          messages: [{ role: "user", content: "hi" }],
          stream: true,
        } as any,
        signal,
      )) {
        chunks.push(c);
      }
      return chunks.map((c) => c.choices[0]?.delta).filter(Boolean);
    };
  }
  const text = (t: string) => ({ contentBlockDelta: { delta: { text: t } } });
  const joined = (deltas: any[], key: string) =>
    deltas.map((d) => d[key] ?? "").join("");

  it("emits the text between the tags as reasoning_content and the rest as content", async () => {
    const collect = streaming([
      text("<thinking>Let me read"),
      text(" the file.</thinking>\n\nThe file has 3 lines."),
      { contentBlockStop: {} },
      { messageStop: { stopReason: "end_turn" } },
    ]);
    const d = await collect("us.amazon.nova-pro-v1:0");
    expect(joined(d, "reasoning_content")).toBe("Let me read the file.");
    expect(joined(d, "content")).toBe("The file has 3 lines.");
  });

  it("handles a tag split across deltas", async () => {
    const collect = streaming([
      text("<thin"),
      text("king>plan</think"),
      text("ing>answer"),
      { contentBlockStop: {} },
    ]);
    const d = await collect("amazon.nova-lite-v1:0");
    expect(joined(d, "reasoning_content")).toBe("plan");
    expect(joined(d, "content")).toBe("answer");
  });

  it("releases a held fragment at the end of the block and leaves other models alone", async () => {
    const nova = await streaming([text("a <"), { contentBlockStop: {} }])(
      "amazon.nova-micro-v1:0",
    );
    expect(joined(nova, "content")).toBe("a <");
    const claude = await streaming([
      text("<thinking>not lifted</thinking>"),
      { contentBlockStop: {} },
    ])("us.anthropic.claude-haiku-4-5");
    expect(joined(claude, "content")).toBe("<thinking>not lifted</thinking>");
    expect(joined(claude, "reasoning_content")).toBe("");
  });
});
