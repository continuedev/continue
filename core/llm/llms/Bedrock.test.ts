import {
  ChatMessage,
  Chunk,
  CompletionOptions,
  UserChatMessage,
} from "../../index.js";
import Bedrock from "./Bedrock.js";

// Mock AWS SDK
jest.mock("@aws-sdk/client-bedrock-runtime", () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
    middlewareStack: { add: jest.fn() },
  })),
  ConverseStreamCommand: jest.fn(),
  InvokeModelCommand: jest.fn(),
}));

// Mock credential provider
jest.mock("@aws-sdk/credential-providers", () => ({
  fromNodeProviderChain: jest.fn().mockImplementation(() => async () => ({
    accessKeyId: "test-access-key",
    secretAccessKey: "test-secret-key",
    sessionToken: "test-session-token",
  })),
}));

// Extend CompletionOptions for testing
interface TestCompletionOptions extends CompletionOptions {
  mockError?: string;
  mockToolUse?: boolean;
}

// Create a test class that overrides the protected methods
class TestBedrock extends Bedrock {
  // Make _streamChat public for testing
  public async *streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: TestCompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    if (options.mockError) {
      throw new Error(options.mockError);
    }

    if (options.mockToolUse) {
      yield {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "tool-1",
            type: "function",
            function: {
              name: "test_tool",
              arguments: '{"arg1":"value1"}',
            },
          },
        ],
      };
      return;
    }

    yield { role: "assistant", content: "Hello" };
    yield { role: "assistant", content: " world" };
  }

  // Override embed to avoid making real API calls
  async embed(chunks: string[]): Promise<number[][]> {
    if (chunks[0] === "error") {
      throw new Error("Embedding Error");
    }
    return [[0.1, 0.2, 0.3]];
  }

  // Override rerank to avoid making real API calls
  async rerank(query: string, chunks: Chunk[]): Promise<number[]> {
    if (!query || !chunks.length) {
      throw new Error("Query and chunks must not be empty");
    }

    if (query === "error") {
      throw new Error("Reranking Error");
    }

    return chunks.map((_, i) => 0.8 - i * 0.3);
  }
}

describe("Bedrock", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with default options", () => {
      const bedrock = new TestBedrock({
        apiKey: "test-key",
        model: "anthropic.claude-3-sonnet-20240229-v1:0",
        region: "us-east-1",
      });

      expect(bedrock.region).toBe("us-east-1");
      expect(bedrock.profile).toBe("bedrock");
      expect(bedrock.apiBase).toBe(
        "https://bedrock-runtime.us-east-1.amazonaws.com",
      );
    });

    it("should use custom options when provided", () => {
      const bedrock = new TestBedrock({
        apiKey: "test-key",
        model: "anthropic.claude-3-sonnet-20240229-v1:0",
        region: "us-west-2",
        profile: "custom-profile",
        apiBase: "https://custom-endpoint.amazonaws.com/",
      });

      expect(bedrock.region).toBe("us-west-2");
      expect(bedrock.profile).toBe("custom-profile");
      expect(bedrock.apiBase).toBe("https://custom-endpoint.amazonaws.com/");
    });
  });

  describe("credentials", () => {
    const base = { model: "anthropic.claude-3-sonnet-20240229-v1:0" };
    const calls: Array<string | undefined> = [];
    let chainImpl: (profile: string | undefined) => Promise<any>;

    class ChainBedrock extends TestBedrock {
      protected async _credentialChain(profile: string | undefined) {
        calls.push(profile);
        return chainImpl(profile);
      }
    }
    const make = (o: any = {}) => new ChainBedrock({ ...base, ...o }) as any;

    beforeEach(() => {
      calls.length = 0;
      chainImpl = async () => ({
        accessKeyId: "chain-key",
        secretAccessKey: "chain-secret",
      });
    });

    it("selects bearer auth for an API key and never asks for IAM credentials", async () => {
      // Without authSchemePreference the AWS SDK may choose SigV4 and fail with "Could not
      // load credentials" on machines that only have a Bedrock API key.
      const b = make({ apiKey: "bedrock-api-key" });
      const auth = await b._clientAuth();

      expect(auth.authSchemePreference).toEqual(["httpBearerAuth"]);
      expect(await auth.token()).toEqual({ token: "bedrock-api-key" });
      expect(auth.credentials).toBeUndefined();
      expect(calls).toEqual([]); // the credential chain was not consulted
    });

    it("passes sessionToken through with explicit keys", async () => {
      const b = make({
        accessKeyId: "AKIA",
        secretAccessKey: "secret",
        sessionToken: "tok",
      });
      await expect(b._getCredentials()).resolves.toEqual({
        accessKeyId: "AKIA",
        secretAccessKey: "secret",
        sessionToken: "tok",
      });
      expect(calls).toEqual([]);
    });

    it("omits sessionToken when not provided", async () => {
      const b = make({ accessKeyId: "AKIA", secretAccessKey: "secret" });
      expect(await b._getCredentials()).not.toHaveProperty("sessionToken");
    });

    it("uses an explicitly configured profile strictly (no fallback)", async () => {
      chainImpl = async () => {
        throw new Error(
          "The SSO session associated with this profile has expired",
        );
      };
      const b = make({ profile: "work" });
      await expect(b._getCredentials()).rejects.toThrow(
        /aws sso login --profile work/,
      );
      expect(calls).toEqual(["work"]);
    });

    it("falls back from the legacy 'bedrock' profile to the default chain when unconfigured", async () => {
      chainImpl = async (profile) => {
        if (profile === "bedrock") throw new Error("profile not found");
        return { accessKeyId: "default-key", secretAccessKey: "s" };
      };
      const b = make();
      const creds = await b._getCredentials();
      expect(creds.accessKeyId).toBe("default-key");
      expect(calls).toEqual(["bedrock", undefined]);
    });

    it("reads AWS_BEARER_TOKEN_BEDROCK only when nothing else is configured", () => {
      process.env.AWS_BEARER_TOKEN_BEDROCK = "env-token";
      try {
        expect((new TestBedrock(base) as any)._resolveApiKey()).toBe(
          "env-token",
        );
        expect(
          (
            new TestBedrock({ ...base, profile: "work" }) as any
          )._resolveApiKey(),
        ).toBeUndefined();
        expect(
          (new TestBedrock({ ...base, apiKey: "cfg" }) as any)._resolveApiKey(),
        ).toBe("cfg");
      } finally {
        delete process.env.AWS_BEARER_TOKEN_BEDROCK;
      }
    });

    it("adds service tier, latency mode and guardrail settings to the request", () => {
      const b: any = new TestBedrock({
        ...base,
        serviceTier: "priority",
        latency: "optimized",
        guardrailIdentifier: "gr-123",
      });
      const input = b._generateConverseInput(
        [{ role: "user", content: "hi" }],
        { model: base.model },
      );
      expect(input.serviceTier).toEqual({ type: "priority" });
      expect(input.performanceConfig).toEqual({ latency: "optimized" });
      expect(input.guardrailConfig).toEqual({
        guardrailIdentifier: "gr-123",
        guardrailVersion: "DRAFT",
      });
    });

    it("omits those fields by default", () => {
      const b: any = new TestBedrock(base);
      const input = b._generateConverseInput(
        [{ role: "user", content: "hi" }],
        { model: base.model },
      );
      expect(input).not.toHaveProperty("serviceTier");
      expect(input).not.toHaveProperty("performanceConfig");
      expect(input).not.toHaveProperty("guardrailConfig");
    });

    it("applies crossRegionInference to the Converse modelId", () => {
      const b: any = new TestBedrock({
        ...base,
        region: "eu-west-1",
        crossRegionInference: "auto",
      });
      const input = b._generateConverseInput(
        [{ role: "user", content: "hi" }],
        { model: base.model },
      );
      expect(input.modelId).toBe(`eu.${base.model}`);
    });
  });

  describe("prompt cache points", () => {
    const sonnet46 = "anthropic.claude-sonnet-4-6";
    const old = "anthropic.claude-3-7-sonnet-20250219-v1:0";
    const tools = [
      {
        type: "function" as const,
        function: { name: "ls", description: "List", parameters: {} },
      },
    ];
    const msgs: ChatMessage[] = [
      { role: "system", content: "You are an agent." },
      { role: "user", content: "fix it" },
      { role: "assistant", content: "ok" },
      { role: "user", content: "and this" },
    ];

    function build(model: string, options: any, ctor: any = {}) {
      const b: any = new TestBedrock({
        apiKey: "k",
        model,
        region: "us-east-1",
        ...ctor,
      });
      b.capabilities = { tools: true };
      return b._generateConverseInput(msgs, { model, tools, ...options });
    }

    const points = (input: any) => ({
      tools: input.toolConfig.tools.filter((t: any) => t.cachePoint),
      system: input.system.filter((s: any) => s.cachePoint),
      messages: input.messages.flatMap((m: any) =>
        m.content.filter((c: any) => c.cachePoint),
      ),
    });

    it("adds no cache points unless caching is asked for", () => {
      const p = points(build(sonnet46, {}));
      expect(p.tools).toHaveLength(0);
      expect(p.system).toHaveLength(0);
      expect(p.messages).toHaveLength(0);
    });

    it("adds cache points to tools, system and the last two user messages", () => {
      const p = points(build(sonnet46, { promptCaching: true }));
      expect(p.tools).toHaveLength(1);
      expect(p.system).toHaveLength(1);
      expect(p.messages).toHaveLength(2);
      expect(p.system[0].cachePoint).toEqual({ type: "default" });
    });

    it("sends ttl 1h on every cache point for a model that supports it", () => {
      const p = points(
        build(sonnet46, { promptCaching: true, promptCacheTtl: "1h" }),
      );
      const all = [...p.tools, ...p.system, ...p.messages];
      expect(all).toHaveLength(4);
      for (const c of all) {
        expect(c.cachePoint).toEqual({ type: "default", ttl: "1h" });
      }
    });

    it("uses cacheBehavior.ttl when the request does not choose", () => {
      const cfg = { cacheBehavior: { ttl: "1h" } };
      const p = points(build(sonnet46, { promptCaching: true }, cfg));
      for (const c of [...p.tools, ...p.system, ...p.messages]) {
        expect(c.cachePoint).toEqual({ type: "default", ttl: "1h" });
      }
      // The request's choice wins over config.
      const q = points(
        build(sonnet46, { promptCaching: true, promptCacheTtl: "5m" }, cfg),
      );
      expect(q.system[0].cachePoint).toEqual({ type: "default" });
      // Config "1h" still never reaches a 5-minute-only model.
      const o = points(build(old, { promptCaching: true }, cfg));
      expect(o.system[0].cachePoint).toEqual({ type: "default" });
    });

    it("never sends ttl to a model that only takes 5 minutes", () => {
      const p = points(
        build(old, { promptCaching: true, promptCacheTtl: "1h" }),
      );
      for (const c of [...p.tools, ...p.system, ...p.messages]) {
        expect(c.cachePoint).toEqual({ type: "default" });
      }
    });

    it.each([
      "openai.gpt-6.1-sol",
      "us.openai.gpt-5.6-sol",
      "amazon.nova-pro-v1:0",
      "us.xai.grok-4.7",
    ])("never sends a cache point to %s, even with caching on", (model) => {
      const input = build(
        model,
        { promptCaching: true, promptCacheTtl: "1h" },
        {
          cacheBehavior: { cacheConversation: true, cacheSystemMessage: true },
        },
      );
      expect(JSON.stringify(input)).not.toContain("cachePoint");
      expect(JSON.stringify(input)).not.toContain("SID:");
    });

    it("an explicit false overrides cacheBehavior", () => {
      const p = points(
        build(
          sonnet46,
          { promptCaching: false },
          {
            cacheBehavior: {
              cacheConversation: true,
              cacheSystemMessage: true,
            },
          },
        ),
      );
      expect(p.tools).toHaveLength(0);
      expect(p.system).toHaveLength(0);
      expect(p.messages).toHaveLength(0);
    });

    it("keeps earlier messages byte-identical from one request to the next", () => {
      const model = sonnet46;
      const b: any = new TestBedrock({
        apiKey: "k",
        model,
        region: "us-east-1",
      });
      const turn = (n: number): ChatMessage[] => {
        const out: ChatMessage[] = [{ role: "system", content: "sys" }];
        for (let i = 1; i <= n; i++) {
          out.push({ role: "user", content: `question ${i}` });
          if (i < n) out.push({ role: "assistant", content: `answer ${i}` });
        }
        return out;
      };
      const convert = (n: number) =>
        b._generateConverseInput(turn(n), { model, promptCaching: true })
          .messages;
      const strip = (m: any) => ({
        ...m,
        content: m.content.filter((c: any) => !c.cachePoint),
      });

      // Everything before the newest user message must match what the
      // previous request sent, apart from where the cache points sit. This is
      // what lets the cached conversation be read back (measured live: with
      // the ID moving between messages, reads stopped growing on turn 3).
      for (let n = 2; n <= 5; n++) {
        const prev = convert(n - 1).map(strip);
        const next = convert(n).map(strip);
        expect(next.slice(0, prev.length - 1)).toEqual(prev.slice(0, -1));
      }
    });

    it("puts the per-process ID on the first user message only", () => {
      const b: any = new TestBedrock({
        apiKey: "k",
        model: sonnet46,
        region: "us-east-1",
      });
      const input = b._generateConverseInput(
        [
          { role: "system", content: "sys" },
          { role: "user", content: "one" },
          { role: "assistant", content: "a" },
          { role: "user", content: "two" },
          { role: "assistant", content: "b" },
          { role: "user", content: "three" },
        ],
        { model: sonnet46, promptCaching: true },
      );
      const texts = input.messages.map((m: any) =>
        m.content.map((c: any) => c.text).filter(Boolean),
      );
      expect(texts[0][0]).toMatch(/^one<!-- SID: .+ -->$/);
      for (const later of texts.slice(1)) {
        for (const t of later) expect(t).not.toContain("SID:");
      }
    });

    describe("on rewritten messages (agent loop)", () => {
      const toolCall = (id: string) => ({
        id,
        type: "function" as const,
        function: { name: "ls", arguments: "{}" },
      });
      // Bedrock rewrites this history: consecutive tool results are folded
      // into ONE user message, so Continue has 9 messages and Bedrock gets 8.
      const loop: ChatMessage[] = [
        { role: "system", content: "You are an agent." },
        { role: "user", content: "fix it" },
        {
          role: "assistant",
          content: "",
          toolCalls: [toolCall("a"), toolCall("b")],
        },
        { role: "tool", content: "out a", toolCallId: "a" },
        { role: "tool", content: "out b", toolCallId: "b" },
        { role: "assistant", content: "", toolCalls: [toolCall("c")] },
        { role: "tool", content: "out c", toolCallId: "c" },
        { role: "assistant", content: "done" },
        { role: "user", content: "next" },
      ];

      function convert(history: ChatMessage[]) {
        const b: any = new TestBedrock({
          apiKey: "k",
          model: sonnet46,
          region: "us-east-1",
        });
        b.capabilities = { tools: true };
        return b._generateConverseInput(history, {
          model: sonnet46,
          tools,
          promptCaching: true,
        }).messages as any[];
      }
      const markerIndexes = (messages: any[]) =>
        messages.flatMap((m, i) =>
          m.content.some((c: any) => c.cachePoint) ? [i] : [],
        );

      it("marks the last two Bedrock user messages, not Continue messages", () => {
        const messages = convert(loop);
        expect(messages.map((m) => m.role)).toEqual([
          "user",
          "assistant",
          "user", // tool results a and b, merged
          "assistant",
          "user", // tool result c
          "assistant",
          "user", // "next"
        ]);
        // Markers on the tool-result message for c and on "next". Not on the
        // merged a+b message, and never on an assistant message.
        expect(markerIndexes(messages)).toEqual([4, 6]);
      });

      it("puts the marker after the last block of the message, outside toolResult", () => {
        const messages = convert(loop);
        for (const i of [4, 6]) {
          const blocks = messages[i].content;
          expect(blocks.filter((c: any) => c.cachePoint)).toHaveLength(1);
          expect(blocks[blocks.length - 1].cachePoint).toEqual({
            type: "default",
          });
        }
        const toolResultMessage = messages[4].content;
        expect(toolResultMessage[0].toolResult.toolUseId).toBe("c");
        expect(JSON.stringify(toolResultMessage[0].toolResult)).not.toContain(
          "cachePoint",
        );
      });

      it("moves the marker to the new last two user messages when the loop grows", () => {
        const grown = convert([
          ...loop,
          { role: "assistant", content: "", toolCalls: [toolCall("d")] },
          { role: "tool", content: "out d", toolCallId: "d" },
        ]);
        // user messages are now 0, 2, 4, 6, 8; the last two are 6 and 8
        expect(markerIndexes(grown)).toEqual([6, 8]);
        // A message that left the window is unchanged except for the marker.
        const before = convert(loop);
        const strip = (m: any) => m.content.filter((c: any) => !c.cachePoint);
        expect(strip(grown[4])).toEqual(strip(before[4]));
      });

      it("counts a single tool-only user message as one marker", () => {
        const messages = convert([
          { role: "system", content: "s" },
          { role: "user", content: "go" },
          { role: "assistant", content: "", toolCalls: [toolCall("a")] },
          { role: "tool", content: "out a", toolCallId: "a" },
        ]);
        expect(markerIndexes(messages)).toEqual([0, 2]);
        expect(messages[2].content.at(-1).cachePoint).toBeDefined();
        expect(messages[2].content[0].toolResult).toBeDefined();
      });
    });

    describe("with the task list block at the tail", () => {
      const toolCall = (id: string) => ({
        id,
        type: "function" as const,
        function: { name: "ls", arguments: "{}" },
      });
      const list = (text: string): ChatMessage => ({
        role: "user",
        content: `<task_list>\n[>] 1. ${text}\n</task_list>`,
      });
      const step1: ChatMessage[] = [
        { role: "system", content: "You are an agent." },
        { role: "user", content: "fix it" },
        { role: "assistant", content: "", toolCalls: [toolCall("a")] },
        { role: "tool", content: "out a", toolCallId: "a" },
      ];
      const step2: ChatMessage[] = [
        ...step1,
        { role: "assistant", content: "", toolCalls: [toolCall("b")] },
        { role: "tool", content: "out b", toolCallId: "b" },
      ];

      function convert(history: ChatMessage[]) {
        const b: any = new TestBedrock({
          apiKey: "k",
          model: sonnet46,
          region: "us-east-1",
        });
        b.capabilities = { tools: true };
        return b._generateConverseInput(history, {
          model: sonnet46,
          tools,
          promptCaching: true,
        });
      }
      // The conversation blocks a request cached: everything before its last
      // cache point, as (role, block) pairs. Cache points are markers, not
      // content, so they are left out.
      const cachedBlocks = (input: any) => {
        const flat: string[] = [];
        let lastPoint = 0;
        for (const m of input.messages) {
          for (const c of m.content) {
            if (c.cachePoint) {
              lastPoint = flat.length;
            } else {
              flat.push(JSON.stringify([m.role, c]));
            }
          }
        }
        return { cached: flat.slice(0, lastPoint), all: flat };
      };

      it("puts the cache point before the block", () => {
        const messages = convert([...step1, list("Run ls")]).messages;
        const last = messages.at(-1).content;
        expect(last.at(-1).text).toMatch(/^<task_list>/);
        expect(last.at(-2).cachePoint).toBeDefined();
        expect(last.at(-1).text).not.toContain("SID:");
      });

      it("keeps the cached prefix byte-identical when the list changes", () => {
        const a = convert([...step1, list("Run ls")]);
        const b = convert([...step2, list("Run ls again")]);
        expect(JSON.stringify(b.toolConfig)).toBe(JSON.stringify(a.toolConfig));
        expect(JSON.stringify(b.system)).toBe(JSON.stringify(a.system));
        const { cached } = cachedBlocks(a);
        const { all } = cachedBlocks(b);
        expect(cached.length).toBeGreaterThan(0);
        expect(all.slice(0, cached.length)).toEqual(cached);
      });

      it("keeps it on the first turn, when the block shares the first user message", () => {
        const a = convert([step1[0], step1[1], list("Start")]);
        const b = convert([...step1, list("Start, then ls")]);
        const { cached } = cachedBlocks(a);
        expect(cached).toHaveLength(1);
        expect(cachedBlocks(b).all.slice(0, 1)).toEqual(cached);
      });

      it("would lose it if the block sat before the cache point (control)", () => {
        // The same text without the tag is treated as ordinary content.
        const plain = (text: string): ChatMessage => ({
          role: "user",
          content: `tasks:\n[>] 1. ${text}`,
        });
        const a = convert([...step1, plain("Run ls")]);
        const b = convert([...step2, plain("Run ls again")]);
        const { cached } = cachedBlocks(a);
        expect(cachedBlocks(b).all.slice(0, cached.length)).not.toEqual(cached);
      });
    });

    it("adds no ID when caching is off", () => {
      const b: any = new TestBedrock({
        apiKey: "k",
        model: sonnet46,
        region: "us-east-1",
      });
      const input = b._generateConverseInput(msgs, { model: sonnet46 });
      expect(JSON.stringify(input.messages)).not.toContain("SID:");
    });

    it("turns the caching header on only when something is cached", () => {
      const on: any = new TestBedrock({ apiKey: "k", model: sonnet46 });
      on._generateConverseInput(msgs, { model: sonnet46, promptCaching: true });
      expect(on.requestOptions.headers).toMatchObject({
        "x-amzn-bedrock-enablepromptcaching": "true",
      });
      const off: any = new TestBedrock({ apiKey: "k", model: sonnet46 });
      off._generateConverseInput(msgs, { model: sonnet46 });
      expect(off.requestOptions.headers ?? {}).not.toHaveProperty(
        "x-amzn-bedrock-enablepromptcaching",
      );
    });
  });

  describe("streamChat", () => {
    let bedrock: TestBedrock;
    const mockAbortSignal = new AbortController().signal;
    const defaultOptions: TestCompletionOptions = {
      model: "anthropic.claude-3-sonnet-20240229-v1:0",
    };

    beforeEach(() => {
      bedrock = new TestBedrock({
        apiKey: "test-key",
        model: "anthropic.claude-3-sonnet-20240229-v1:0",
        region: "us-east-1",
      });
    });

    it("should handle text streaming correctly", async () => {
      const messages: ChatMessage[] = [
        {
          role: "user",
          content: "Hi",
        } as UserChatMessage,
      ];

      const results = [];

      for await (const message of bedrock.streamChat(
        messages,
        mockAbortSignal,
        defaultOptions,
      )) {
        results.push(message);
      }

      expect(results).toEqual([
        { role: "assistant", content: "Hello" },
        { role: "assistant", content: " world" },
      ]);
    });

    it("should handle tool use streaming correctly", async () => {
      const messages: ChatMessage[] = [
        {
          role: "user",
          content: "Use a tool",
        } as UserChatMessage,
      ];

      const results = [];
      const options: TestCompletionOptions = {
        ...defaultOptions,
        mockToolUse: true,
      };

      for await (const message of bedrock.streamChat(
        messages,
        mockAbortSignal,
        options,
      )) {
        results.push(message);
      }

      expect(results).toEqual([
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "tool-1",
              type: "function",
              function: {
                name: "test_tool",
                arguments: '{"arg1":"value1"}',
              },
            },
          ],
        },
      ]);
    });

    it("should handle API errors", async () => {
      const messages: ChatMessage[] = [
        {
          role: "user",
          content: "Hi",
        } as UserChatMessage,
      ];

      const options: TestCompletionOptions = {
        ...defaultOptions,
        mockError: "API Error",
      };

      await expect(async () => {
        for await (const _ of bedrock.streamChat(
          messages,
          mockAbortSignal,
          options,
        )) {
          // consume generator
        }
      }).rejects.toThrow("API Error");
    });
  });

  describe("embed", () => {
    let bedrock: TestBedrock;

    beforeEach(() => {
      bedrock = new TestBedrock({
        apiKey: "test-key",
        model: "cohere.embed-english-v3",
        region: "us-east-1",
      });
    });

    it("should handle embedding requests correctly", async () => {
      const result = await bedrock.embed(["test text"]);
      expect(result).toEqual([[0.1, 0.2, 0.3]]);
    });

    it("should handle embedding errors", async () => {
      await expect(bedrock.embed(["error"])).rejects.toThrow("Embedding Error");
    });
  });

  describe("rerank", () => {
    let bedrock: TestBedrock;

    beforeEach(() => {
      bedrock = new TestBedrock({
        apiKey: "test-key",
        model: "cohere.rerank-english-v2.0",
        region: "us-east-1",
      });
    });

    it("should handle reranking requests correctly", async () => {
      const chunks: Chunk[] = [
        {
          content: "doc1",
          digest: "digest1",
          filepath: "file1",
          index: 0,
          startLine: 1,
          endLine: 1,
        },
        {
          content: "doc2",
          digest: "digest2",
          filepath: "file2",
          index: 1,
          startLine: 1,
          endLine: 1,
        },
      ];

      const result = await bedrock.rerank("query", chunks);
      expect(result).toEqual([0.8, 0.5]);
    });

    it("should handle reranking errors", async () => {
      const chunk: Chunk = {
        content: "doc1",
        digest: "digest1",
        filepath: "file1",
        index: 0,
        startLine: 1,
        endLine: 1,
      };

      await expect(bedrock.rerank("error", [chunk])).rejects.toThrow(
        "Reranking Error",
      );
    });

    it("should throw error for empty input", async () => {
      await expect(bedrock.rerank("", [])).rejects.toThrow(
        "Query and chunks must not be empty",
      );
    });
  });

  describe("message conversion", () => {
    let bedrock: TestBedrock;

    beforeEach(() => {
      bedrock = new TestBedrock({
        apiKey: "test-key",
        model: "anthropic.claude-3-sonnet-20240229-v1:0",
        region: "us-east-1",
      });
    });

    it("should convert simple user and assistant messages correctly", () => {
      const messages: ChatMessage[] = [
        { role: "user", content: "Hello" } as UserChatMessage,
        { role: "assistant", content: "Hi there" },
      ];

      const availableTools = new Set<string>();
      const converted = bedrock["_convertMessages"](messages, availableTools);

      expect(converted).toEqual([
        { role: "user", content: [{ text: "Hello" }] },
        { role: "assistant", content: [{ text: "Hi there" }] },
      ]);
    });

    it("should handle tool responses correctly", () => {
      const messages: ChatMessage[] = [
        { role: "user", content: "Use a tool" } as UserChatMessage,
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "tool-1",
              type: "function",
              function: {
                name: "test_tool",
                arguments: '{"arg":"value"}',
              },
            },
          ],
        },
        {
          role: "tool",
          content: "Tool result",
          toolCallId: "tool-1",
        },
      ];

      const availableTools = new Set(["test_tool"]);
      const converted = bedrock["_convertMessages"](messages, availableTools);

      expect(converted).toEqual([
        { role: "user", content: [{ text: "Use a tool" }] },
        {
          role: "assistant",
          content: [
            {
              toolUse: {
                toolUseId: "tool-1",
                name: "test_tool",
                input: { arg: "value" },
              },
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              toolResult: {
                toolUseId: "tool-1",
                content: [{ text: "Tool result" }],
              },
            },
          ],
        },
      ]);
    });

    it("puts a message sent while tools ran in the same user turn as their results (steering)", () => {
      const messages: ChatMessage[] = [
        { role: "user", content: "Use a tool" } as UserChatMessage,
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "tool-1",
              type: "function",
              function: { name: "test_tool", arguments: "{}" },
            },
          ],
        },
        { role: "tool", content: "Tool result", toolCallId: "tool-1" },
        { role: "user", content: "Also check the tests" } as UserChatMessage,
      ];

      const converted = bedrock["_convertMessages"](
        messages,
        new Set(["test_tool"]),
      );

      // Roles still alternate, and the results come before the text
      expect(converted.map((m: any) => m.role)).toEqual([
        "user",
        "assistant",
        "user",
      ]);
      expect(converted[2].content).toEqual([
        {
          toolResult: {
            toolUseId: "tool-1",
            content: [{ text: "Tool result" }],
          },
        },
        { text: "Also check the tests" },
      ]);
    });

    it("should handle tool calls with unavailable tools as text", () => {
      const messages: ChatMessage[] = [
        { role: "user", content: "Use a tool" } as UserChatMessage,
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "tool-1",
              type: "function",
              function: {
                name: "unavailable_tool",
                arguments: '{"arg":"value"}',
              },
            },
          ],
        },
      ];

      // Empty set means no tools are available
      const availableTools = new Set<string>();
      const converted = bedrock["_convertMessages"](messages, availableTools);

      expect(converted).toEqual([
        { role: "user", content: [{ text: "Use a tool" }] },
        {
          role: "assistant",
          content: [
            {
              text: expect.stringContaining("Assistant tool call:"),
            },
          ],
        },
      ]);
    });

    it("should handle thinking messages correctly", () => {
      const messages: ChatMessage[] = [
        { role: "user", content: "Think about this" } as UserChatMessage,
        { role: "thinking", content: "I am thinking about the solution" },
        { role: "assistant", content: "Here's my answer" },
      ];

      const availableTools = new Set<string>();
      const converted = bedrock["_convertMessages"](messages, availableTools);

      expect(converted).toEqual([
        { role: "user", content: [{ text: "Think about this" }] },
        {
          role: "assistant",
          content: [
            {
              reasoningContent: {
                reasoningText: {
                  text: "I am thinking about the solution",
                  signature: undefined,
                },
              },
            },
            { text: "Here's my answer" },
          ],
        },
      ]);
    });

    it("should handle redacted thinking messages", () => {
      const messages: ChatMessage[] = [
        { role: "user", content: "Think about this" } as UserChatMessage,
        {
          role: "thinking",
          content: "",
          redactedThinking: "redacted-content-bytes",
        },
        { role: "assistant", content: "Here's my answer" },
      ];

      const availableTools = new Set<string>();
      const converted = bedrock["_convertMessages"](messages, availableTools);

      expect(converted).toEqual([
        { role: "user", content: [{ text: "Think about this" }] },
        {
          role: "assistant",
          content: [
            {
              reasoningContent: {
                redactedContent: expect.any(Uint8Array),
              },
            },
            { text: "Here's my answer" },
          ],
        },
      ]);

      // Check that the Uint8Array contains the expected bytes
      const redactedContent =
        converted[1].content?.[0].reasoningContent?.redactedContent;
      expect(redactedContent).toBeInstanceOf(Uint8Array);
      expect(Buffer.from(redactedContent!).toString()).toBe(
        "redacted-content-bytes",
      );
    });

    it("should convert multimodal content correctly", () => {
      const messages: ChatMessage[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "Look at this image:" },
            {
              type: "imageUrl",
              imageUrl: {
                url: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
              },
            },
          ],
        } as UserChatMessage,
      ];

      const availableTools = new Set<string>();
      const converted = bedrock["_convertMessages"](messages, availableTools);

      expect(converted).toEqual([
        {
          role: "user",
          content: [
            { text: "Look at this image:" },
            {
              image: {
                format: "jpeg",
                source: {
                  bytes: expect.any(Uint8Array),
                },
              },
            },
          ],
        },
      ]);

      // Check that the image bytes were processed correctly
      const imageBytes = converted[0].content?.[1].image?.source?.bytes;
      expect(imageBytes).toBeInstanceOf(Uint8Array);
      expect(Buffer.from(imageBytes!).toString("base64")).toBe(
        "/9j/4AAQSkZJRg==",
      );
    });

    it("should add cache points when cacheBehavior.cacheConversation is enabled", () => {
      // Create a test instance with caching behavior enabled
      const bedrockWithCaching = new TestBedrock({
        apiKey: "test-key",
        model: "anthropic.claude-3-sonnet-20240229-v1:0",
        region: "us-east-1",
      });

      // Set caching behavior
      bedrockWithCaching.cacheBehavior = {
        cacheConversation: true,
        cacheSystemMessage: true,
      };

      const messages: ChatMessage[] = [
        { role: "system", content: "You are a helpful assistant" },
        { role: "user", content: "First message" } as UserChatMessage,
        { role: "assistant", content: "First response" },
        { role: "user", content: "Second message" } as UserChatMessage,
      ];

      const availableTools = new Set<string>();
      const converted = bedrockWithCaching["_convertMessages"](
        messages,
        availableTools,
      );

      // The last two user messages should have cache points
      // But we're not testing the system message here since it's handled separately
      expect(converted.length).toBe(3);
      expect(converted[0].role).toBe("user");
      expect(converted[0].content?.some((block) => block.cachePoint)).toBe(
        true,
      );
      expect(converted[1].role).toBe("assistant");
      expect(converted[2].role).toBe("user");
      expect(converted[2].content?.some((block) => block.cachePoint)).toBe(
        true,
      );

      // Verify that text content includes a cache ID suffix
      const userMessageText = converted[0].content?.[0].text;
      expect(userMessageText).toMatch(/First message.+/);
    });

    it("should add cache points when completionOptions.promptCaching is enabled", () => {
      // Create a test instance with prompt caching enabled via completionOptions
      const bedrockWithPromptCaching = new TestBedrock({
        apiKey: "test-key",
        model: "anthropic.claude-3-sonnet-20240229-v1:0",
        region: "us-east-1",
      });

      // Set completionOptions.promptCaching (without cacheBehavior)
      bedrockWithPromptCaching.completionOptions = {
        ...bedrockWithPromptCaching.completionOptions,
        promptCaching: true,
      };

      const messages: ChatMessage[] = [
        { role: "user", content: "First message" } as UserChatMessage,
        { role: "assistant", content: "First response" },
        { role: "user", content: "Second message" } as UserChatMessage,
      ];

      const availableTools = new Set<string>();
      const converted = bedrockWithPromptCaching["_convertMessages"](
        messages,
        availableTools,
      );

      // The last two user messages should have cache points
      expect(converted.length).toBe(3);
      expect(converted[0].role).toBe("user");
      expect(converted[0].content?.some((block) => block.cachePoint)).toBe(
        true,
      );
      expect(converted[1].role).toBe("assistant");
      expect(converted[2].role).toBe("user");
      expect(converted[2].content?.some((block) => block.cachePoint)).toBe(
        true,
      );

      // Verify that text content includes a cache ID suffix
      const userMessageText = converted[0].content?.[0].text;
      expect(userMessageText).toMatch(/First message.+/);
    });

    it("should not add cache points when both caching options are disabled", () => {
      // Create a test instance with no caching enabled
      const bedrockNoCaching = new TestBedrock({
        apiKey: "test-key",
        model: "anthropic.claude-3-sonnet-20240229-v1:0",
        region: "us-east-1",
      });

      // Explicitly set no caching
      bedrockNoCaching.cacheBehavior = {
        cacheConversation: false,
        cacheSystemMessage: false,
      };
      bedrockNoCaching.completionOptions = {
        ...bedrockNoCaching.completionOptions,
        promptCaching: false,
      };

      const messages: ChatMessage[] = [
        { role: "user", content: "First message" } as UserChatMessage,
        { role: "assistant", content: "First response" },
        { role: "user", content: "Second message" } as UserChatMessage,
      ];

      const availableTools = new Set<string>();
      const converted = bedrockNoCaching["_convertMessages"](
        messages,
        availableTools,
      );

      // No cache points should be added
      expect(converted.length).toBe(3);
      expect(converted[0].role).toBe("user");
      expect(converted[0].content?.some((block) => block.cachePoint)).toBe(
        false,
      );
      expect(converted[1].role).toBe("assistant");
      expect(converted[2].role).toBe("user");
      expect(converted[2].content?.some((block) => block.cachePoint)).toBe(
        false,
      );

      // Verify that text content doesn't include a cache ID suffix
      const userMessageText = converted[0].content?.[0].text;
      expect(userMessageText).toBe("First message");
    });
  });
});
