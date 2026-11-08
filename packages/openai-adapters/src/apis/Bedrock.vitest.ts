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

  it("puts the process ID on the first user message only", () => {
    const body = convert({ promptCaching: true });
    const texts = body.messages.map((m: any) =>
      m.content.map((b: any) => b.text ?? "").join(""),
    );
    const withId = texts.filter((t: string) => t.includes("SID:"));
    expect(withId).toHaveLength(1);
    expect(texts[0]).toContain("SID:");
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
    "us.amazon.nova-pro-v1:0",
    "us.xai.grok-4.7",
  ])("sends no cachePoint to %s even with promptCaching on", (model) => {
    expect(JSON.stringify(body(model))).not.toContain("cachePoint");
    expect(JSON.stringify(body(model))).not.toContain("SID:");
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
