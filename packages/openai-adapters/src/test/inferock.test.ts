import http from "node:http";
import { describe, expect, it } from "vitest";
import { InferockApi, normalizeInferockApiBase } from "../apis/Inferock.js";
import { constructLlmApi } from "../index.js";

describe("InferockApi", () => {
  it("normalizes gateway base URLs and throws clearly when apiBase is missing", () => {
    expect(() => normalizeInferockApiBase(undefined)).toThrow(/apiBase/);
    expect(() => normalizeInferockApiBase("   ")).toThrow(/apiBase/);
    expect(
      normalizeInferockApiBase("https://tenant.lambda-url.us-west-2.on.aws"),
    ).toBe("https://tenant.lambda-url.us-west-2.on.aws/v1/");
    expect(
      normalizeInferockApiBase("https://tenant.lambda-url.us-west-2.on.aws/v1"),
    ).toBe("https://tenant.lambda-url.us-west-2.on.aws/v1/");
    expect(
      normalizeInferockApiBase("https://tenant.lambda-url.us-west-2.on.aws/v1/"),
    ).toBe("https://tenant.lambda-url.us-west-2.on.aws/v1/");
  });

  it("constructs InferockApi via constructLlmApi with default governance header", () => {
    const api = constructLlmApi({
      provider: "inferock",
      apiKey: "fake-key",
      apiBase: "https://tenant.inferock.example",
    });
    expect(api).toBeInstanceOf(InferockApi);
    expect((api as InferockApi).apiBase).toBe(
      "https://tenant.inferock.example/v1/",
    );
  });

  it("merges extraBodyProperties, preserves reasoning_effort, and strips unsupported Dane fields", () => {
    const api = new InferockApi({
      provider: "inferock",
      apiKey: "fake-key",
      apiBase: "https://tenant.inferock.example",
      requestOptions: {
        timeout: 600,
        extraBodyProperties: {
          reasoning_effort: "low",
          temperature: 0.9,
        },
      },
    });

    expect(api.openai.timeout).toBe(600_000);

    const sanitized = api.modifyChatBody({
      model: "dane",
      messages: [{ role: "user", content: "Reply only OK." }],
      stream: true,
      max_completion_tokens: 1024,
      temperature: 0.2,
      top_p: 0.9,
      frequency_penalty: 0.1,
      presence_penalty: 0.1,
      response_format: { type: "json_object" },
      parallel_tool_calls: true,
      prediction: { type: "content", content: "draft" },
      tools: [
        {
          type: "function",
          function: {
            name: "get_weather",
            description: "Get weather",
            strict: false,
            parameters: { type: "object", properties: {} },
          },
        },
      ],
    } as any);

    expect(sanitized.model).toBe("dane");
    expect((sanitized as any).max_completion_tokens).toBe(1024);
    expect(sanitized.temperature).toBeUndefined();
    expect(sanitized.top_p).toBeUndefined();
    expect(sanitized.frequency_penalty).toBeUndefined();
    expect(sanitized.presence_penalty).toBeUndefined();
    expect(sanitized.response_format).toBeUndefined();
    expect(sanitized.parallel_tool_calls).toBeUndefined();
    expect((sanitized as any).prediction).toBeUndefined();
    expect((sanitized as any).stream_options).toEqual({ include_usage: true });
    expect((sanitized.tools?.[0] as any)?.function?.strict).toBeUndefined();
    expect((sanitized as any).reasoning_effort).toBe("low");
  });

  it("sends Bearer auth, x-governance-provider header, and sanitized body over HTTP", async () => {
    let capturedPath = "";
    let capturedHeaders: http.IncomingHttpHeaders = {};
    let capturedBody: Record<string, unknown> = {};

    const server = http.createServer((req, res) => {
      capturedPath = req.url ?? "";
      capturedHeaders = req.headers;
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        capturedBody = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            id: "chatcmpl-1",
            object: "chat.completion",
            created: 1,
            model: "dane",
            choices: [
              {
                index: 0,
                message: { role: "assistant", content: "OK" },
                finish_reason: "stop",
              },
            ],
            usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
          }),
        );
      });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected ephemeral TCP port");
    }

    try {
      const api = new InferockApi({
        provider: "inferock",
        apiKey: "fake-inferock-key",
        apiBase: `http://127.0.0.1:${address.port}`,
        requestOptions: {
          extraBodyProperties: { reasoning_effort: "xhigh", temperature: 0.5 },
        },
      });

      const res = await api.chatCompletionNonStream(
        {
          model: "dane",
          stream: false,
          temperature: 0.2,
          messages: [{ role: "user", content: "Say OK" }],
        },
        new AbortController().signal,
      );

      expect(res.choices[0].message.content).toBe("OK");
      expect(capturedPath).toBe("/v1/chat/completions");
      expect(capturedHeaders.authorization).toBe("Bearer fake-inferock-key");
      expect(capturedHeaders["x-governance-provider"]).toBe("inferock-serve");
      expect(capturedBody.reasoning_effort).toBe("xhigh");
      expect("temperature" in capturedBody).toBe(false);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
