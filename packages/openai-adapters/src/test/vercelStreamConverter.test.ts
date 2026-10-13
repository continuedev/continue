import type { ChatCompletionChunk } from "openai/resources/index";
import { describe, expect, test } from "vitest";
import {
  convertVercelStream,
  convertVercelStreamPart,
  type VercelStreamPart,
} from "../vercelStreamConverter.js";

describe("convertVercelStreamPart", () => {
  const options = { model: "gpt-4o-mini" };

  test("converts text-delta to chat chunk", () => {
    const part: VercelStreamPart = {
      type: "text-delta",
      id: "text-1",
      text: "Hello",
    };

    const result = convertVercelStreamPart(part, options);

    expect(result).not.toBeNull();
    expect(result?.object).toBe("chat.completion.chunk");
    expect(result?.model).toBe("gpt-4o-mini");
    expect(result?.choices).toHaveLength(1);
    expect(result?.choices[0].delta.content).toBe("Hello");
  });

  test("converts reasoning-delta to chat chunk", () => {
    const part: VercelStreamPart = {
      type: "reasoning-delta",
      id: "reasoning-1",
      text: "Let me think...",
    };

    const result = convertVercelStreamPart(part, options);

    expect(result).not.toBeNull();
    expect((result?.choices[0].delta as any).reasoning_content).toBe(
      "Let me think...",
    );
    expect(result?.choices[0].delta.content).toBeUndefined();
  });

  test("returns null for tool-call without thoughtSignature", () => {
    const part: VercelStreamPart = {
      type: "tool-call",
      toolCallId: "call_abc123",
      toolName: "readFile",
      input: { filepath: "/path/to/file" },
    };

    expect(convertVercelStreamPart(part, options)).toBeNull();
  });

  test("converts tool-call with thoughtSignature to extra_content chunk", () => {
    const part: VercelStreamPart = {
      type: "tool-call",
      toolCallId: "call_abc123",
      toolName: "readFile",
      input: { filepath: "/path/to/file" },
      providerMetadata: {
        google: {
          thoughtSignature: "sig123",
        },
      },
    };

    const result = convertVercelStreamPart(part, options);

    expect(result).not.toBeNull();
    expect(result?.choices[0].delta.tool_calls).toHaveLength(1);
    expect(result?.choices[0].delta.tool_calls?.[0]).toEqual({
      index: 0,
      extra_content: {
        google: { thought_signature: "sig123" },
      },
    });
  });

  test("converts tool-input-delta to chat chunk", () => {
    const part: VercelStreamPart = {
      type: "tool-input-delta",
      id: "call_abc123",
      delta: '{"filepath":',
    };

    const result = convertVercelStreamPart(part, options);

    expect(result).not.toBeNull();
    expect(result?.choices[0].delta.tool_calls).toHaveLength(1);
    expect(result?.choices[0].delta.tool_calls?.[0]).toEqual({
      index: 0,
      function: {
        arguments: '{"filepath":',
      },
    });
  });

  test("converts finish to usage chunk", () => {
    const part: VercelStreamPart = {
      type: "finish",
      finishReason: "stop",
      totalUsage: {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      },
    };

    const result = convertVercelStreamPart(part, options);

    expect(result).not.toBeNull();
    expect(result?.usage).toEqual({
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    });
  });

  test("throws error for error event", () => {
    const part: VercelStreamPart = {
      type: "error",
      error: new Error("Test error"),
    };

    expect(() => convertVercelStreamPart(part, options)).toThrow("Test error");
  });

  test("returns null for start-step (no OpenAI equivalent)", () => {
    const part: VercelStreamPart = {
      type: "start-step",
    };

    const result = convertVercelStreamPart(part, options);

    expect(result).toBeNull();
  });

  test("returns null for finish-step (no OpenAI equivalent)", () => {
    const part: VercelStreamPart = {
      type: "finish-step",
      response: {},
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      },
      finishReason: "stop",
    };

    const result = convertVercelStreamPart(part, options);

    expect(result).toBeNull();
  });

  test("returns null for tool-result (no OpenAI equivalent)", () => {
    const part: VercelStreamPart = {
      type: "tool-result",
      toolCallId: "call_abc123",
      result: { success: true },
    };

    const result = convertVercelStreamPart(part, options);

    expect(result).toBeNull();
  });

  test("returns null for source", () => {
    const part: VercelStreamPart = {
      type: "source",
      source: { url: "https://example.com" },
    };

    const result = convertVercelStreamPart(part, options);

    expect(result).toBeNull();
  });

  test("returns null for file", () => {
    const part: VercelStreamPart = {
      type: "file",
      file: { name: "output.txt", content: "file content" },
    };

    const result = convertVercelStreamPart(part, options);

    expect(result).toBeNull();
  });

  test("converts tool-input-start to initial tool call chunk with id and name", () => {
    const part: VercelStreamPart = {
      type: "tool-input-start",
      id: "call_abc123",
      toolName: "readFile",
    };

    const result = convertVercelStreamPart(part, options);

    expect(result).not.toBeNull();
    expect(result?.choices[0].delta.tool_calls).toHaveLength(1);
    expect(result?.choices[0].delta.tool_calls?.[0]).toEqual({
      index: 0,
      id: "call_abc123",
      type: "function",
      function: {
        name: "readFile",
        arguments: "",
      },
    });
  });
});

describe("convertVercelStream", () => {
  const options = { model: "gpt-4o-mini" };

  test("converts stream of mixed events", async () => {
    const parts: VercelStreamPart[] = [
      { type: "start-step" },
      { type: "text-delta", id: "text-1", text: "Hello " },
      { type: "text-delta", id: "text-1", text: "world" },
      { type: "tool-input-start", id: "call_1", toolName: "test" },
      { type: "tool-input-delta", id: "call_1", delta: '{"arg":"value"}' },
      { type: "tool-input-end", id: "call_1" },
      {
        type: "tool-call",
        toolCallId: "call_1",
        toolName: "test",
        input: { arg: "value" },
      },
      {
        type: "finish-step",
        response: {},
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
      {
        type: "finish",
        finishReason: "stop",
        totalUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      },
    ];

    async function* streamParts() {
      for (const part of parts) {
        yield part;
      }
    }

    const chunks = [];
    for await (const chunk of convertVercelStream(streamParts(), options)) {
      chunks.push(chunk);
    }

    // text-delta (2) + tool-input-start (1) + tool-input-delta (1) + finish (1) = 5
    // start-step, tool-input-end, tool-call (no thoughtSignature), and finish-step are filtered out
    expect(chunks).toHaveLength(5);

    expect(chunks[0].choices[0].delta.content).toBe("Hello ");
    expect(chunks[1].choices[0].delta.content).toBe("world");
    expect(chunks[2].choices[0].delta.tool_calls?.[0].id).toBe("call_1");
    expect(chunks[2].choices[0].delta.tool_calls?.[0].function?.name).toBe(
      "test",
    );
    expect(chunks[3].choices[0].delta.tool_calls?.[0].function?.arguments).toBe(
      '{"arg":"value"}',
    );
    expect(chunks[4].usage).toBeDefined();
  });

  test.each(["sequential", "interleaved"] as const)(
    "keeps tool call indices stable for %s calls",
    async (order) => {
      const first: VercelStreamPart[] = [
        { type: "tool-input-start", id: "call_a", toolName: "readFile" },
        { type: "tool-input-delta", id: "call_a", delta: '{"path":"' },
        { type: "tool-input-delta", id: "call_a", delta: 'a.txt"}' },
        {
          type: "tool-call",
          toolCallId: "call_a",
          toolName: "readFile",
          input: { path: "a.txt" },
          providerMetadata: { google: { thoughtSignature: "sig_a" } },
        },
      ];
      const second: VercelStreamPart[] = [
        { type: "tool-input-start", id: "call_b", toolName: "readFile" },
        { type: "tool-input-delta", id: "call_b", delta: '{"path":"' },
        { type: "tool-input-delta", id: "call_b", delta: 'b.txt"}' },
        {
          type: "tool-call",
          toolCallId: "call_b",
          toolName: "readFile",
          input: { path: "b.txt" },
          providerMetadata: { vertex: { thoughtSignature: "sig_b" } },
        },
      ];
      const parts =
        order === "sequential"
          ? [...first, ...second]
          : [
              first[0],
              first[1],
              second[0],
              second[1],
              first[2],
              second[2],
              second[3],
              first[3],
            ];

      async function* streamParts() {
        yield* parts;
      }

      const toolCalls: NonNullable<
        ChatCompletionChunk.Choice["delta"]["tool_calls"]
      > = [];
      for await (const chunk of convertVercelStream(streamParts(), options)) {
        toolCalls.push(chunk.choices[0].delta.tool_calls![0]);
      }

      expect(toolCalls.map((call) => call.index)).toEqual(
        order === "sequential"
          ? [0, 0, 0, 0, 1, 1, 1, 1]
          : [0, 0, 1, 1, 0, 1, 1, 0],
      );
      expect(
        [0, 1].map((index) =>
          toolCalls
            .filter((call) => call.index === index)
            .map((call) => call.function?.arguments ?? "")
            .join(""),
        ),
      ).toEqual(['{"path":"a.txt"}', '{"path":"b.txt"}']);
      expect(toolCalls).toContainEqual({
        index: 0,
        extra_content: { google: { thought_signature: "sig_a" } },
      });
      expect(toolCalls).toContainEqual({
        index: 1,
        extra_content: { google: { thought_signature: "sig_b" } },
      });
    },
  );

  test("throws error when stream contains error event", async () => {
    const parts: VercelStreamPart[] = [
      { type: "text-delta", id: "text-1", text: "Hello" },
      { type: "error", error: new Error("Stream error") },
    ];

    async function* streamParts() {
      for (const part of parts) {
        yield part;
      }
    }

    const chunks = [];
    try {
      for await (const chunk of convertVercelStream(streamParts(), options)) {
        chunks.push(chunk);
      }
      throw new Error("Should have thrown error");
    } catch (error: any) {
      expect(error.message).toBe("Stream error");
      expect(chunks).toHaveLength(1); // Only the first chunk before error
    }
  });

  test("filters out all non-convertible events", async () => {
    const parts: VercelStreamPart[] = [
      { type: "start-step" },
      { type: "source", source: {} },
      { type: "file", file: { name: "test.txt", content: "content" } },
      { type: "tool-result", toolCallId: "call_1", result: {} },
    ];

    async function* streamParts() {
      for (const part of parts) {
        yield part;
      }
    }

    const chunks = [];
    for await (const chunk of convertVercelStream(streamParts(), options)) {
      chunks.push(chunk);
    }

    // All events should be filtered out
    expect(chunks).toHaveLength(0);
  });
});
