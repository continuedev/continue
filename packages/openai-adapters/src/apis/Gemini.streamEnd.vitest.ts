import { describe, expect, it } from "vitest";

import { GeminiApi } from "./Gemini.js";

const api = () =>
  new GeminiApi({ provider: "gemini", apiKey: "k" } as any) as any;

async function* stream(chunks: any[]) {
  for (const c of chunks) yield c;
}

async function textOf(chunks: any[], signal?: AbortSignal) {
  let out = "";
  for await (const c of api().processStreamResponse(
    stream(chunks),
    "gemini-2.5-pro",
    signal,
  )) {
    out += c.choices?.[0]?.delta?.content ?? "";
  }
  return out;
}

const part = (text: string, finishReason?: string) => ({
  candidates: [
    { content: { parts: [{ text }] }, ...(finishReason && { finishReason }) },
  ],
});

describe("Gemini stream end", () => {
  it("returns the reply when the last chunk has a finishReason", async () => {
    await expect(textOf([part("Hel"), part("lo", "STOP")])).resolves.toBe(
      "Hello",
    );
  });

  it("reports a stream with no finishReason as cut off", async () => {
    await expect(textOf([part("Hel")])).rejects.toThrow(
      /ended before the response was complete/,
    );
  });

  it("does not report a stopped reply as cut off", async () => {
    const c = new AbortController();
    c.abort();
    await expect(textOf([part("Hel")], c.signal)).resolves.toBe("Hel");
  });

  it("does not complain about a stream with no content at all", async () => {
    await expect(
      textOf([{ usageMetadata: { promptTokenCount: 1 } }]),
    ).resolves.toBe("");
  });
});
