import { ILLM } from "../../index.js";

export interface LlmTestCase {
  llm: ILLM;
  methodToTest: keyof ILLM;
  params: any[];
  expectedRequest: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: Record<string, any>;
  };
  mockResponse?: any;
  mockStream?: string[]; // array of string chunks for SSE
}

export async function runLlmTest(testCase: LlmTestCase) {
  const {
    llm,
    methodToTest,
    params,
    expectedRequest,
    mockResponse,
    mockStream,
  } = testCase;

  const mockFetch = jest.fn();

  if (mockStream) {
    const encoder = new TextEncoder();
    let streamIndex = 0;
    mockFetch.mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: () => {
            if (streamIndex >= mockStream.length) {
              return Promise.resolve({ done: true, value: undefined });
            }
            const chunk = mockStream[streamIndex++];
            const encoded = encoder.encode(chunk);
            return Promise.resolve({
              done: false,
              value: encoded,
            });
          },
        }),
      },
      headers: new Headers({
        "Content-Type": "text/event-stream",
      }),
    });
  } else {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });
  }

  // @ts-ignore
  llm.fetch = mockFetch;

  // @ts-ignore
  if (typeof llm[methodToTest] !== "function") {
    throw new Error(
      `Method ${String(methodToTest)} does not exist on the LLM instance.`,
    );
  }

  // @ts-ignore
  const result = await llm[methodToTest](...params);

  if (mockStream) {
    // Consume the stream to ensure it's processed correctly
    for await (const _ of result) {
    }
  }

  expect(mockFetch).toHaveBeenCalledTimes(1);
  const [url, options] = mockFetch.mock.calls[0];

  expect(url.toString()).toBe(expectedRequest.url);
  expect(options.method).toBe(expectedRequest.method);

  if (expectedRequest.headers) {
    expect(options.headers).toEqual(expectedRequest.headers);
  }

  if (expectedRequest.body) {
    const actualBody = JSON.parse(options.body as string);
    expect(actualBody).toEqual(expectedRequest.body);
  }
}
