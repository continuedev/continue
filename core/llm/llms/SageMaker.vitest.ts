import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatMessage } from "../../index.js";

// Simulated streaming body returned by the SageMaker runtime client.
// A multibyte UTF-8 character is split across two network chunks.
let mockBody: AsyncIterable<{ PayloadPart?: { Bytes?: Uint8Array } }>;

vi.mock("@aws-sdk/client-sagemaker-runtime", () => ({
  SageMakerRuntimeClient: class {
    async send() {
      return { Body: mockBody };
    }
  },
  InvokeEndpointCommand: class {
    constructor(public input: any) {}
  },
  InvokeEndpointWithResponseStreamCommand: class {
    constructor(public input: any) {}
  },
}));

vi.mock("@aws-sdk/credential-providers", () => ({
  fromNodeProviderChain: () => async () => ({
    accessKeyId: "test",
    secretAccessKey: "test",
    sessionToken: "test",
  }),
}));

import SageMaker from "./SageMaker.js";

function bodyFromChunks(chunks: Uint8Array[]) {
  return (async function* () {
    for (const c of chunks) {
      yield { PayloadPart: { Bytes: c } };
    }
  })();
}

describe("SageMaker streaming multibyte handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not corrupt a multibyte character split across chunks (_streamChat)", async () => {
    const line = 'data:{"choices":[{"delta":{"content":"\u{1F600}"}}]}\n';
    const bytes = new TextEncoder().encode(line);
    // Split in the middle of the 4-byte emoji sequence (starts with 0xF0).
    const idx = bytes.indexOf(0xf0);
    const chunk1 = bytes.slice(0, idx + 2);
    const chunk2 = bytes.slice(idx + 2);
    mockBody = bodyFromChunks([chunk1, chunk2]);

    const sm = new SageMaker({ model: "m", region: "us-west-2" } as any);
    const messages: ChatMessage[] = [{ role: "user", content: "hi" }];
    const out: string[] = [];
    for await (const msg of (sm as any)._streamChat(
      messages,
      new AbortController().signal,
      {},
    )) {
      out.push(msg.content as string);
    }

    expect(out.join("")).toBe("\u{1F600}");
  });

  it("does not corrupt a multibyte character split across chunks (_streamComplete)", async () => {
    const line = 'data:{"choices":[{"text":"café"}]}\n';
    const bytes = new TextEncoder().encode(line);
    // Split in the middle of the 2-byte é sequence (starts with 0xC3).
    const idx = bytes.indexOf(0xc3);
    const chunk1 = bytes.slice(0, idx + 1);
    const chunk2 = bytes.slice(idx + 1);
    mockBody = bodyFromChunks([chunk1, chunk2]);

    const sm = new SageMaker({ model: "m", region: "us-west-2" } as any);
    const out: string[] = [];
    for await (const chunk of (sm as any)._streamComplete(
      "hi",
      new AbortController().signal,
      {},
    )) {
      out.push(chunk as string);
    }

    expect(out.join("")).toBe("café");
  });
});
