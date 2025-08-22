import { vi } from "vitest";

// Mock BaseLlmApi class to avoid inline class definitions
class MockBaseLlmApi {}

/**
 * Mock the constructLlmApi function to return a mock LLM API
 */
export function mockLLMResponse(response: string) {
  const mockApi = {
    chatCompletionStream: async function* () {
      // Simulate streaming response
      const words = response.split(" ");
      for (const word of words) {
        yield {
          choices: [
            {
              delta: {
                content: word + " ",
              },
            },
          ],
        };
      }
    },

    chatCompletion: async () => ({
      choices: [
        {
          message: {
            role: "assistant",
            content: response,
          },
        },
      ],
    }),

    // Add any other methods that might be used
    completionStream: async function* () {
      yield response;
    },

    completion: async () => response,
  };

  vi.doMock("@continuedev/openai-adapters", () => ({
    constructLlmApi: () => mockApi,
    BaseLlmApi: MockBaseLlmApi,
    LLMConfig: {},
  }));

  return mockApi;
}

/**
 * Mock streaming responses with chunks
 */
export function mockLLMStreamResponse(chunks: string[]) {
  const mockApi = {
    chatCompletionStream: async function* () {
      for (const chunk of chunks) {
        yield {
          choices: [
            {
              delta: {
                content: chunk,
              },
            },
          ],
        };
      }
    },

    chatCompletion: async () => ({
      choices: [
        {
          message: {
            role: "assistant",
            content: chunks.join(""),
          },
        },
      ],
    }),

    completionStream: async function* () {
      for (const chunk of chunks) {
        yield chunk;
      }
    },

    completion: async () => chunks.join(""),
  };

  vi.doMock("@continuedev/openai-adapters", () => ({
    constructLlmApi: () => mockApi,
    BaseLlmApi: MockBaseLlmApi,
    LLMConfig: {},
  }));

  return mockApi;
}

/**
 * Mock an error response from the LLM
 */
export function mockLLMError(errorMessage: string) {
  const mockApi = {
    chatCompletionStream: async function* () {
      throw new Error(errorMessage);
    },

    chatCompletion: async () => {
      throw new Error(errorMessage);
    },

    completionStream: async function* () {
      throw new Error(errorMessage);
    },

    completion: async () => {
      throw new Error(errorMessage);
    },
  };

  vi.doMock("@continuedev/openai-adapters", () => ({
    constructLlmApi: () => mockApi,
    BaseLlmApi: MockBaseLlmApi,
    LLMConfig: {},
  }));

  return mockApi;
}

/**
 * Clear all LLM mocks
 */
export function clearLLMMocks() {
  vi.unmock("@continuedev/openai-adapters");
}
