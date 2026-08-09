import { Readable } from "stream";
import { describe, expect, it, test } from "vitest";
import { parseDataLine, streamSse } from "./stream.js";

function createMockResponse(sseLines: string[]): Response {
  // Create a Readable stream that emits the SSE lines
  const stream = new Readable({
    read() {
      for (const line of sseLines) {
        this.push(line + "\n\n");
      }
      this.push(null); // End of stream
    },
  }) as any;

  // Minimal Response mock
  return {
    status: 200,
    body: stream,
    text: async () => "",
  } as unknown as Response;
}

describe("streamSse", () => {
  it("yields parsed SSE data objects that ends with `data:[DONE]`", async () => {
    const sseLines = [
      'data: {"foo": "bar"}',
      'data: {"baz": 42}',
      "data:[DONE]",
    ];
    const response = createMockResponse(sseLines);

    const results = [];
    for await (const data of streamSse(response)) {
      results.push(data);
    }

    expect(results).toEqual([{ foo: "bar" }, { baz: 42 }]);
  });

  it("yields parsed SSE data objects that ends with `data: [DONE]` (with a space before [DONE]", async () => {
    const sseLines = [
      'data: {"foo": "bar"}',
      'data: {"baz": 42}',
      "data: [DONE]",
    ];
    const response = createMockResponse(sseLines);

    const results = [];
    for await (const data of streamSse(response)) {
      results.push(data);
    }

    expect(results).toEqual([{ foo: "bar" }, { baz: 42 }]);
  });

  it("throws on malformed JSON", async () => {
    const sseLines = ['data: {"foo": "bar"', "data:[DONE]"];
    const response = createMockResponse(sseLines);

    const iterator = streamSse(response)[Symbol.asyncIterator]();
    await expect(iterator.next()).rejects.toThrow(/Malformed JSON/);
  });
});

describe("parseDataLine", () => {
  test("parseDataLine should parse valid JSON data with 'data: ' prefix", () => {
    const line = 'data: {"message":"hello","status":"ok"}';
    const result = parseDataLine(line);
    expect(result).toEqual({ message: "hello", status: "ok" });
  });

  test("parseDataLine should parse valid JSON data with 'data:' prefix (no space)", () => {
    const line = 'data:{"message":"hello","status":"ok"}';
    const result = parseDataLine(line);
    expect(result).toEqual({ message: "hello", status: "ok" });
  });

  test("parseDataLine should throw error for malformed JSON", () => {
    const line = "data: {invalid json}";
    expect(() => parseDataLine(line)).toThrow(
      "Malformed JSON sent from server",
    );
  });

  test("parseDataLine should throw error when data contains error field", () => {
    const line = 'data: {"error":"something went wrong"}';
    expect(() => parseDataLine(line)).toThrow(
      'Error streaming response: "something went wrong"',
    );
  });

  test("parseDataLine should throw error when data contains error object with message", () => {
    const line = 'data: {"error":{"message":"detailed error message"}}';
    expect(() => parseDataLine(line)).toThrow(
      "Error streaming response: detailed error message",
    );
  });

  test("parseDataLine should handle empty objects", () => {
    const line = "data: {}";
    const result = parseDataLine(line);
    expect(result).toEqual({});
  });

  test("parseDataLine should handle arrays", () => {
    const line = "data: [1,2,3]";
    const result = parseDataLine(line);
    expect(result).toEqual([1, 2, 3]);
  });

  test("parseDataLine should handle nested objects", () => {
    const line = 'data: {"user":{"name":"John","age":30}}';
    const result = parseDataLine(line);
    expect(result).toEqual({ user: { name: "John", age: 30 } });
  });
});
