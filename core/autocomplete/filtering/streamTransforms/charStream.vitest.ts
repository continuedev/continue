import { describe, expect, it } from "vitest";
import { stopAtStartOf, stopAtStopTokens } from "./charStream";

async function* createMockStream(chunks: string[]): AsyncGenerator<string> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

async function streamToString(stream: AsyncGenerator<string>): Promise<string> {
  let result = "";
  for await (const chunk of stream) {
    result += chunk;
  }
  return result;
}

describe("stopAtStopTokens", () => {
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

    expect(await streamToString(result)).toBe("This is a test. ");
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

    expect(await streamToString(result)).toBe("This is a complete stream");
  });

  it("should handle empty chunks", async () => {
    const mockStream = createMockStream(["Hello", "", " world", "", "! STOP"]);
    const stopTokens = ["STOP"];
    const result = stopAtStopTokens(mockStream, stopTokens);

    expect(await streamToString(result)).toBe("Hello world! ");
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

    expect(await streamToString(result)).toBe("Hello world");
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

    expect(await streamToString(result)).toBe("This is a test with multiple ");
  });

  it("should handle an empty stream", async () => {
    const mockStream = createMockStream([]);
    const stopTokens = ["STOP"];
    const result = stopAtStopTokens(mockStream, stopTokens);

    expect(await streamToString(result)).toBe("");
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

    expect(await streamToString(result)).toBe("Hello world!");
  });
});

describe("stopAtStartOf", () => {
  const sampleCode = `      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: \`Bearer \${this.workOsAccessToken}\`,
        },
      },
    );
    const data = await response.json();
    return data.items;
  }

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const response = await extras.fetch(
      new URL(
        \`/proxy/context/\${this.options.id}/retrieve\`,
        controlPlaneEnv.CONTROL_PLANE_URL,
      ),
`;

  /* Some LLMs, such as Codestral, repeat the suffix of the query. To test our filtering, we cut the sample code at random positions, remove a part of the input
and construct a response, containing the removed part and the suffix. The goal of the stopAtStartOf() method is to detect the start of the suffix in the response */
  it("should stop if the start of the suffix is reached", async () => {
    const suffix = `
  const data = await response.json();
  return data.items;
}`;
    const mockStream = createMockStream(sampleCode.split(/(?! )/g));
    const result = stopAtStartOf(mockStream, suffix);

    const resultStr = await streamToString(result);
    expect(resultStr).toBe(`      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: \`Bearer \${this.workOsAccessToken}\`,
        },
      },
    );
    `);
  });
  it("should stop if the start of the suffix is reached, even if the suffix has a prefix", async () => {
    const suffix = `
  xxxconst data = await response.json();
  return data.items;
}`;
    const mockStream = createMockStream(sampleCode.split(/(?! )/g));
    const result = stopAtStartOf(mockStream, suffix);

    const resultStr = await streamToString(result);
    expect(resultStr).toBe(`      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: \`Bearer \${this.workOsAccessToken}\`,
        },
      },
    );
    `);
  });
});
