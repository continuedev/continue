import { ChatMessage } from "../../index.js";
import Bedrock from "./Bedrock.js";

jest.mock("@aws-sdk/client-bedrock-runtime", () => ({
  BedrockRuntimeClient: jest.fn(),
  ConverseStreamCommand: jest.fn().mockImplementation((input) => ({ input })),
  InvokeModelCommand: jest.fn(),
}));
jest.mock("@aws-sdk/credential-providers", () => ({
  fromNodeProviderChain: jest.fn().mockReturnValue(async () => ({
    accessKeyId: "k",
    secretAccessKey: "s",
  })),
}));

/**
 * A Bedrock whose client returns the given Converse stream events. It replaces
 * the private `_getClient`, which TypeScript rejects; Jest does not type-check.
 */
// @ts-expect-error overriding a private method on purpose
class StreamBedrock extends Bedrock {
  constructor(
    private events: any[],
    private requestId: string | null = "req-abc",
  ) {
    super({
      apiKey: "k",
      model: "anthropic.claude-sonnet-4-6",
      region: "us-east-1",
    } as any);
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async _getClient(): Promise<any> {
    const events = this.events;
    return {
      middlewareStack: { add: jest.fn() },
      send: async () => ({
        $metadata: { requestId: this.requestId ?? undefined },
        stream: (async function* () {
          for (const e of events) yield e;
        })(),
      }),
    };
  }
  run(): AsyncGenerator<ChatMessage> {
    return (this as any)._streamChat(
      [{ role: "user", content: "hi" }],
      new AbortController().signal,
      { model: "anthropic.claude-sonnet-4-6" },
    );
  }
}

async function usageOf(b: StreamBedrock) {
  const out: ChatMessage[] = [];
  for await (const m of b.run()) out.push(m);
  return out.filter((m) => m.role === "assistant" && (m as any).usage);
}

const text = { contentBlockDelta: { delta: { text: "Hello" } } };
const usage = {
  inputTokens: 12,
  outputTokens: 34,
  cacheReadInputTokens: 5000,
  cacheWriteInputTokens: 700,
};

describe("Bedrock stream response facts", () => {
  it("passes on the stop reason, the latency and the request ID", async () => {
    const chunks = await usageOf(
      new StreamBedrock([
        text,
        { messageStop: { stopReason: "tool_use" } },
        { metadata: { usage, metrics: { latencyMs: 812 } } },
      ]),
    );
    expect(chunks).toHaveLength(1);
    const u = (chunks[0] as any).usage;
    expect(u.promptTokens).toBe(12);
    expect(u.promptTokensDetails.cachedTokens).toBe(5000);
    expect(u.response).toEqual({
      stopReason: "tool_use",
      latencyMs: 812,
      requestId: "req-abc",
    });
  });

  it("reports only what the provider sent", async () => {
    const chunks = await usageOf(
      new StreamBedrock([text, { metadata: { usage } }], null),
    );
    expect((chunks[0] as any).usage.response).toBeUndefined();
  });

  it("keeps a latency of zero", async () => {
    const chunks = await usageOf(
      new StreamBedrock([
        text,
        { metadata: { usage, metrics: { latencyMs: 0 } } },
      ]),
    );
    expect((chunks[0] as any).usage.response).toMatchObject({ latencyMs: 0 });
  });

  it("sends no usage chunk when the stream carried no usage", async () => {
    const chunks = await usageOf(
      new StreamBedrock([text, { messageStop: { stopReason: "end_turn" } }]),
    );
    expect(chunks).toHaveLength(0);
  });
});
