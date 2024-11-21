import { stopAtStopTokens } from "./charStream";

describe("stopAtStopTokens", () => {
  async function* createMockStream(chunks: string[]): AsyncGenerator<string> {
    for (const chunk of chunks) {
      yield chunk;
    }
  }

  it("should yield characters until a stop token is encountered", async () => {
    const mockStream = createMockStream(["Hello", " world", "! Stop", "here"]);
    const stopTokens = ["Stop"];
    const result = stopAtStopTokens(mockStream, stopTokens);

    const output = [];
    for await (const char of result) {
      output.push(char);
    }

    expect(output.join("")).toBe("Hello world! ");
  });

  it("should handle multiple stop tokens", async () => {
    const mockStream = createMockStream([
      "This",
      " is a ",
      "test. END",
      " of stream",
    ]);
    const stopTokens = ["END", "STOP", "HALT"];
    const result = stopAtStopTokens(mockStream, stopTokens);

    const output = [];
    for await (const char of result) {
      output.push(char);
    }

    expect(output.join("")).toBe("This is a test. ");
  });

  it("should handle stop tokens split across chunks", async () => {
    const mockStream = createMockStream([
      "Hello",
      " wo",
      "r",
      "ld! ST",
      "OP now",
    ]);
    const stopTokens = ["STOP"];
    const result = stopAtStopTokens(mockStream, stopTokens);

    const output = [];
    for await (const char of result) {
      output.push(char);
    }

    expect(output.join("")).toBe("Hello world! ");
  });

  it("should yield all characters if no stop token is encountered", async () => {
    const mockStream = createMockStream([
      "This",
      " is ",
      "a complete",
      " stream",
    ]);
    const stopTokens = ["END"];
    const result = stopAtStopTokens(mockStream, stopTokens);

    const output = [];
    for await (const char of result) {
      output.push(char);
    }

    expect(output.join("")).toBe("This is a complete stream");
  });

  it("should handle empty chunks", async () => {
    const mockStream = createMockStream(["Hello", "", " world", "", "! STOP"]);
    const stopTokens = ["STOP"];
    const result = stopAtStopTokens(mockStream, stopTokens);

    const output = [];
    for await (const char of result) {
      output.push(char);
    }

    expect(output.join("")).toBe("Hello world! ");
  });

  it("should handle stop token at the beginning of the stream", async () => {
    const mockStream = createMockStream(["STOP", "Hello world"]);
    const stopTokens = ["STOP"];
    const result = stopAtStopTokens(mockStream, stopTokens);

    const output = [];
    for await (const char of result) {
      output.push(char);
    }

    expect(output.join("")).toBe("");
  });

  it("should handle stop token at the end of the stream", async () => {
    const mockStream = createMockStream(["Hello world", "STOP"]);
    const stopTokens = ["STOP"];
    const result = stopAtStopTokens(mockStream, stopTokens);

    const output = [];
    for await (const char of result) {
      output.push(char);
    }

    expect(output.join("")).toBe("Hello world");
  });

  it("should handle multiple stop tokens of different lengths", async () => {
    const mockStream = createMockStream([
      "This is a ",
      "test with ",
      "multiple STOP",
      " tokens END",
    ]);
    const stopTokens = ["STOP", "END", "HALT"];
    const result = stopAtStopTokens(mockStream, stopTokens);

    const output = [];
    for await (const char of result) {
      output.push(char);
    }

    expect(output.join("")).toBe("This is a test with multiple ");
  });

  it("should handle an empty stream", async () => {
    const mockStream = createMockStream([]);
    const stopTokens = ["STOP"];
    const result = stopAtStopTokens(mockStream, stopTokens);

    const output = [];
    for await (const char of result) {
      output.push(char);
    }

    expect(output.join("")).toBe("");
  });

  it("should handle an empty stop tokens array", async () => {
    const mockStream = createMockStream(["Hello", " world!"]);
    const stopTokens: string[] = [];
    const result = stopAtStopTokens(mockStream, stopTokens);

    const output = [];
    for await (const char of result) {
      output.push(char);
    }

    expect(output.join("")).toBe("Hello world!");
  });

  it("should handle stop token when remaining buffer is smaller than maximum stop token length", async () => {
    const mockStream = createMockStream(["Hello world!STOP"]);
    const stopTokens: string[] = [
      "STOP",
      "STOP_TOKEN_THAT_IS_LARGER_THAN_BUFFER",
    ];
    const result = stopAtStopTokens(mockStream, stopTokens);

    const output = [];
    for await (const char of result) {
      output.push(char);
    }

    expect(output.join("")).toBe("Hello world!");
  });
});
