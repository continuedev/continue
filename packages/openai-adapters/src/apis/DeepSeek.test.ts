import { fetchwithRequestOptions } from "@continuedev/fetch";
import { afterEach, describe, expect, test, vi } from "vitest";

import { FimCreateParamsStreaming } from "./base.js";
import { DeepSeekApi } from "./DeepSeek.js";

vi.mock("@continuedev/fetch", async () => {
  const actual =
    await vi.importActual<typeof import("@continuedev/fetch")>(
      "@continuedev/fetch",
    );
  return {
    ...actual,
    fetchwithRequestOptions: vi.fn(),
  };
});

const fimBody: FimCreateParamsStreaming = {
  model: "deepseek-coder",
  prompt: "function add(a, b) {\n  ",
  suffix: "\n}",
  max_tokens: 128,
  temperature: 0.2,
  top_p: 0.95,
  frequency_penalty: 0.1,
  presence_penalty: 0,
  stop: ["\n\n"],
  stream: true,
};

async function collectFim(apiBase?: string) {
  const encoder = new TextEncoder();
  const events = [
    { choices: [{ text: "return " }] },
    { choices: [{ text: "a + b;" }], finish_reason: "stop" },
  ];
  const stream = new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      }
      controller.close();
    },
  });
  vi.mocked(fetchwithRequestOptions).mockResolvedValue(
    new Response(stream, {
      headers: { "Content-Type": "text/event-stream" },
    }) as any,
  );

  const api = new DeepSeekApi({
    provider: "deepseek",
    apiKey: "test-api-key",
    apiBase,
  });

  let text = "";
  for await (const chunk of api.fimStream(
    fimBody,
    new AbortController().signal,
  )) {
    text += chunk.choices[0]?.delta?.content ?? "";
  }

  const [url, init] = vi.mocked(fetchwithRequestOptions).mock.calls[0];
  return { url: String(url), init, text };
}

describe("DeepSeekApi fimStream", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("requests /beta/completions when apiBase ends in /beta/", async () => {
    const { url, init, text } = await collectFim(
      "https://api.deepseek.com/beta/",
    );

    expect(url).toBe("https://api.deepseek.com/beta/completions");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: "Bearer test-api-key",
    });
    expect(JSON.parse(init?.body as string)).toEqual({
      model: "deepseek-coder",
      prompt: "function add(a, b) {\n  ",
      suffix: "\n}",
      max_tokens: 128,
      temperature: 0.2,
      top_p: 0.95,
      frequency_penalty: 0.1,
      presence_penalty: 0,
      stop: ["\n\n"],
      stream: true,
    });
    expect(text).toBe("return a + b;");
  });

  test("still requests /beta/completions for the default root base", async () => {
    const { url, text } = await collectFim("https://api.deepseek.com/");

    expect(url).toBe("https://api.deepseek.com/beta/completions");
    expect(text).toBe("return a + b;");
  });

  test("surfaces a non-success FIM response", async () => {
    vi.mocked(fetchwithRequestOptions).mockResolvedValue(
      new Response("beta completions unavailable", { status: 400 }) as any,
    );

    const api = new DeepSeekApi({
      provider: "deepseek",
      apiKey: "test-api-key",
      apiBase: "https://api.deepseek.com/beta/",
    });

    const stream = api.fimStream(fimBody, new AbortController().signal);
    await expect(stream.next()).rejects.toThrow("beta completions unavailable");

    const [url] = vi.mocked(fetchwithRequestOptions).mock.calls[0];
    expect(String(url)).toBe("https://api.deepseek.com/beta/completions");
  });
});
