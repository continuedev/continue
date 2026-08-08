import { expect, jest } from "@jest/globals";
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

  const mockFetch = jest.fn<any>();

  if (mockStream) {
    const encoder = new TextEncoder();
    let streamIndex = 0;
    mockFetch.mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            mockStream.forEach((chunk) => {
              controller.enqueue(new TextEncoder().encode(chunk));
            });
            controller.close();
          },
        }),
        {
          headers: {
            "Content-Type": "text/event-stream",
          },
        },
      ),
    );
  } else {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );
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
  const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];

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
