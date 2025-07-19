import { jest } from "@jest/globals";
import { vi } from "vitest";

// Check if we're using Jest or Vitest
const testFramework = typeof jest !== 'undefined' ? 'jest' : 'vitest';

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
          choices: [{
            delta: {
              content: word + " "
            }
          }]
        };
      }
    },
    
    chatCompletion: async () => ({
      choices: [{
        message: {
          role: "assistant",
          content: response
        }
      }]
    }),
    
    // Add any other methods that might be used
    completionStream: async function* () {
      yield response;
    },
    
    completion: async () => response,
  };

  if (testFramework === 'jest') {
    jest.doMock("@continuedev/openai-adapters", () => ({
      constructLlmApi: () => mockApi,
      BaseLlmApi: class {},
      LLMConfig: {}
    }));
  } else {
    vi.doMock("@continuedev/openai-adapters", () => ({
      constructLlmApi: () => mockApi,
      BaseLlmApi: class {},
      LLMConfig: {}
    }));
  }
  
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
          choices: [{
            delta: {
              content: chunk
            }
          }]
        };
      }
    },
    
    chatCompletion: async () => ({
      choices: [{
        message: {
          role: "assistant",
          content: chunks.join("")
        }
      }]
    }),
    
    completionStream: async function* () {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
    
    completion: async () => chunks.join(""),
  };

  if (testFramework === 'jest') {
    jest.doMock("@continuedev/openai-adapters", () => ({
      constructLlmApi: () => mockApi,
      BaseLlmApi: class {},
      LLMConfig: {}
    }));
  } else {
    vi.doMock("@continuedev/openai-adapters", () => ({
      constructLlmApi: () => mockApi,
      BaseLlmApi: class {},
      LLMConfig: {}
    }));
  }
  
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

  if (testFramework === 'jest') {
    jest.doMock("@continuedev/openai-adapters", () => ({
      constructLlmApi: () => mockApi,
      BaseLlmApi: class {},
      LLMConfig: {}
    }));
  } else {
    vi.doMock("@continuedev/openai-adapters", () => ({
      constructLlmApi: () => mockApi,
      BaseLlmApi: class {},
      LLMConfig: {}
    }));
  }
  
  return mockApi;
}

/**
 * Clear all LLM mocks
 */
export function clearLLMMocks() {
  if (testFramework === 'jest') {
    jest.dontMock("@continuedev/openai-adapters");
  } else {
    vi.unmock("@continuedev/openai-adapters");
  }
}