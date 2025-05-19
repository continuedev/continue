import { Readable } from "stream";
import { streamSse } from "./stream.js";

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
