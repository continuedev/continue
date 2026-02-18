import { describe, test, expect } from "vitest";
import {
  convertVercelStreamPart,
  convertVercelStream,
  type VercelStreamPart,
} from "../vercelStreamConverter.js";

describe("convertVercelStreamPart", () => {
  const options = { model: "gpt-4o-mini" };

  test("converts text-delta to chat chunk", () => {
    const part: VercelStreamPart = {
      type: "text-delta",
      textDelta: "Hello",
    };

    const result = convertVercelStreamPart(part, options);

    expect(result).not.toBeNull();
    expect(result?.object).toBe("chat.completion.chunk");
    expect(result?.model).toBe("gpt-4o-mini");
    expect(result?.choices).toHaveLength(1);
    expect(result?.choices[0].delta.content).toBe("Hello");
  });

  test("converts reasoning to chat chunk", () => {
    const part: VercelStreamPart = {
      type: "reasoning",
      textDelta: "Let me think...",
    };

    const result = convertVercelStreamPart(part, options);

    expect(result).not.toBeNull();
    expect(result?.choices[0].delta.content).toBe("Let me think...");
  });

  test("converts tool-call to chat chunk", () => {
    const part: VercelStreamPart = {
      type: "tool-call",
      toolCallId: "call_abc123",
      toolName: "readFile",
      args: { filepath: "/path/to/file" },
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
        arguments: JSON.stringify({ filepath: "/path/to/file" }),
      },
    });
  });

  test("converts tool-call-delta to chat chunk", () => {
    const part: VercelStreamPart = {
      type: "tool-call-delta",
      toolCallId: "call_abc123",
      toolName: "readFile",
      argsTextDelta: '{"filepath":',
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
      usage: {
        promptTokens: 100,
        completionTokens: 50,
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

  test("returns null for step-start (no OpenAI equivalent)", () => {
    const part: VercelStreamPart = {
      type: "step-start",
      messageId: "msg-123",
      request: {},
      warnings: [],
    };

    const result = convertVercelStreamPart(part, options);

    expect(result).toBeNull();
  });

  test("returns null for step-finish (no OpenAI equivalent)", () => {
    const part: VercelStreamPart = {
      type: "step-finish",
      messageId: "msg-123",
      request: {},
      response: {},
      usage: {
        promptTokens: 100,
        completionTokens: 50,
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

  test("returns null for reasoning-signature", () => {
    const part: VercelStreamPart = {
      type: "reasoning-signature",
      signature: "sig_123",
    };

    const result = convertVercelStreamPart(part, options);

    expect(result).toBeNull();
  });

  test("returns null for redacted-reasoning", () => {
    const part: VercelStreamPart = {
      type: "redacted-reasoning",
      data: "[REDACTED]",
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
      name: "output.txt",
      content: "file content",
    };

    const result = convertVercelStreamPart(part, options);

    expect(result).toBeNull();
  });

  test("returns null for tool-call-streaming-start", () => {
    const part: VercelStreamPart = {
      type: "tool-call-streaming-start",
      toolCallId: "call_abc123",
      toolName: "readFile",
    };

    const result = convertVercelStreamPart(part, options);

    expect(result).toBeNull();
  });
});

describe("convertVercelStream", () => {
  const options = { model: "gpt-4o-mini" };

  test("converts stream of mixed events", async () => {
    const parts: VercelStreamPart[] = [
      { type: "step-start", messageId: "msg-123", request: {}, warnings: [] },
      { type: "text-delta", textDelta: "Hello " },
      { type: "text-delta", textDelta: "world" },
      {
        type: "tool-call",
        toolCallId: "call_1",
        toolName: "test",
        args: { arg: "value" },
      },
      {
        type: "step-finish",
        messageId: "msg-123",
        request: {},
        response: {},
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
      {
        type: "finish",
        finishReason: "stop",
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
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

    // Should only get chunks for: text-delta (2), tool-call (1), finish (1) = 4 chunks
    // step-start and step-finish are filtered out
    expect(chunks).toHaveLength(4);

    expect(chunks[0].choices[0].delta.content).toBe("Hello ");
    expect(chunks[1].choices[0].delta.content).toBe("world");
    expect(chunks[2].choices[0].delta.tool_calls?.[0].function?.name).toBe(
      "test",
    );
    expect(chunks[3].usage).toBeDefined();
  });

  test("throws error when stream contains error event", async () => {
    const parts: VercelStreamPart[] = [
      { type: "text-delta", textDelta: "Hello" },
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
      { type: "step-start", messageId: "msg-123", request: {}, warnings: [] },
      { type: "reasoning-signature", signature: "sig_123" },
      { type: "redacted-reasoning", data: "[REDACTED]" },
      { type: "source", source: {} },
      { type: "file", name: "test.txt", content: "content" },
      {
        type: "tool-call-streaming-start",
        toolCallId: "call_1",
        toolName: "test",
      },
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
