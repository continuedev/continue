import { beforeEach, describe, expect, it, vi } from "vitest";

const sent: any[] = [];
const send = vi.fn();

vi.mock("@aws-sdk/client-bedrock-runtime", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  BedrockRuntimeClient: vi.fn().mockImplementation(function () {
    return { send, middlewareStack: { add: vi.fn() } };
  }),
  ConverseStreamCommand: vi.fn().mockImplementation(function (input: any) {
    // Snapshot: the provider mutates its input object between attempts.
    sent.push(JSON.parse(JSON.stringify(input)));
    return { input };
  }),
  InvokeModelCommand: vi.fn(),
}));

import Bedrock from "./Bedrock";
import { isStopSequencesUnsupportedError } from "./bedrockHelpers";

const STOP_ERROR =
  "This model doesn't support the stopSequences field. Remove stopSequences and try again.";

function stream(...deltas: any[]) {
  return {
    stream: (async function* () {
      for (const delta of deltas) yield { contentBlockDelta: { delta } };
      yield { messageStop: { stopReason: "end_turn" } };
    })(),
  };
}

async function complete(llm: Bedrock, stop?: string[]) {
  let out = "";
  for await (const chunk of llm.streamComplete(
    "prompt",
    new AbortController().signal,
    { stop, raw: true },
  )) {
    out += chunk;
  }
  return out;
}

describe("Bedrock autocomplete", () => {
  beforeEach(() => {
    sent.length = 0;
    send.mockReset();
  });

  it("retries without stop sequences when the model refuses them, and remembers", async () => {
    const llm = new Bedrock({
      apiKey: "k",
      model: "qwen.qwen3-coder-30b-a3b-v1:0",
      region: "us-east-1",
    });
    send
      .mockRejectedValueOnce(new Error(STOP_ERROR))
      .mockResolvedValueOnce(stream({ text: "return 1;" }))
      .mockResolvedValueOnce(stream({ text: "return 2;" }));

    expect(await complete(llm, ["</COMPLETION>"])).toBe("return 1;");
    expect(sent.map((i) => i.inferenceConfig.stopSequences)).toEqual([
      ["</COMPLETION>"],
      undefined,
    ]);

    // The next request for the same model skips the failing attempt.
    expect(await complete(llm, ["</COMPLETION>"])).toBe("return 2;");
    expect(sent).toHaveLength(3);
    expect(sent[2].inferenceConfig.stopSequences).toBeUndefined();
  });

  it("still sends stop sequences to models that accept them", async () => {
    const llm = new Bedrock({
      apiKey: "k",
      model: "us.amazon.nova-micro-v1:0",
      region: "us-east-1",
    });
    send.mockResolvedValueOnce(stream({ text: "x" }));
    await complete(llm, ["</COMPLETION>"]);
    expect(sent[0].inferenceConfig.stopSequences).toEqual(["</COMPLETION>"]);
  });

  it("does not retry other errors", async () => {
    const llm = new Bedrock({
      apiKey: "k",
      model: "mistral.devstral-2-123b",
      region: "us-east-1",
    });
    send.mockRejectedValueOnce(new Error("ThrottlingException: slow down"));
    await expect(complete(llm, ["x"])).rejects.toThrow(/slow down/);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("leaves reasoning out of the completion", async () => {
    const llm = new Bedrock({
      apiKey: "k",
      model: "openai.gpt-oss-20b-1:0",
      region: "us-east-1",
    });
    send.mockResolvedValueOnce(
      stream(
        { reasoningContent: { text: "We need to fill the hole." } },
        { text: "Math.sqrt(dx * dx + dy * dy)" },
      ),
    );
    expect(await complete(llm)).toBe("Math.sqrt(dx * dx + dy * dy)");
  });

  it("gives autocomplete a timeout that fits Bedrock's first-token latency", () => {
    const llm = new Bedrock({ apiKey: "k", model: "m", region: "us-east-1" });
    expect(llm.providerAutocompleteDefaults?.modelTimeout).toBe(2000);
  });

  it("recognizes the refusal message", () => {
    expect(isStopSequencesUnsupportedError(new Error(STOP_ERROR))).toBe(true);
    expect(isStopSequencesUnsupportedError(new Error("other"))).toBe(false);
    expect(isStopSequencesUnsupportedError(undefined)).toBe(false);
  });
});
