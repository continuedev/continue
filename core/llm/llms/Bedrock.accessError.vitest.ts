import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();

vi.mock("@aws-sdk/client-bedrock-runtime", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  BedrockRuntimeClient: vi.fn().mockImplementation(function () {
    return { send, middlewareStack: { add: vi.fn() } };
  }),
}));

import Bedrock from "./Bedrock";

const AWS_TEXT =
  "anthropic.claude-haiku-5-5 is not available for this account. You can explore other available models on Amazon Bedrock.";

const refusal = (message: string) =>
  Object.assign(new Error(message), { name: "AccessDeniedException" });

async function chat(llm: Bedrock) {
  const chunks = llm.streamChat(
    [{ role: "user", content: "hi" }],
    new AbortController().signal,
  );
  for await (const _ of chunks) {
    // the first step throws
  }
}

describe("Bedrock chat when the call is refused", () => {
  const llm = () =>
    new Bedrock({
      apiKey: "k",
      model: "anthropic.claude-haiku-5-5",
      region: "us-east-1",
      crossRegionInference: "us",
    });

  beforeEach(() => {
    send.mockReset();
  });

  it("explains a model the account has not been given, naming the ID it sent", async () => {
    send.mockRejectedValue(refusal(AWS_TEXT));
    const error = (await chat(llm()).catch((e: Error) => e)) as Error;
    expect(error.name).toBe("AccessDeniedException");
    expect(error.message).toContain("refused us.anthropic.claude-haiku-5-5");
    expect(error.message).toContain("use-case form");
    expect(error.message.endsWith(`AWS said: ${AWS_TEXT}`)).toBe(true);
    // The generic access hint would contradict it.
    expect(error.message).not.toContain("bedrock:InvokeModel");
  });

  it("keeps the existing message and hint for another AccessDenied refusal", async () => {
    const text =
      "User: dev is not authorized to perform: bedrock:InvokeModel on this model";
    send.mockRejectedValue(refusal(text));
    const error = (await chat(llm()).catch((e: Error) => e)) as Error;
    expect(error.message.startsWith(`${text}\n\nAccess denied.`)).toBe(true);
    expect(error.message).not.toContain("use-case form");
  });
});
