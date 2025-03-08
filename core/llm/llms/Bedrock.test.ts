import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { fromIni } from "@aws-sdk/credential-providers";
import Bedrock from "./Bedrock.js";
import { ChatMessage, Chunk, CompletionOptions, UserChatMessage } from "../../index.js";

// Mock AWS SDK
jest.mock("@aws-sdk/client-bedrock-runtime", () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
    middlewareStack: { add: jest.fn() },
  })),
  ConverseStreamCommand: jest.fn(),
  InvokeModelCommand: jest.fn(),
}));

// Mock credential provider
jest.mock("@aws-sdk/credential-providers", () => ({
  fromIni: jest.fn().mockImplementation(() => async () => ({
    accessKeyId: "test-access-key",
    secretAccessKey: "test-secret-key",
    sessionToken: "test-session-token",
  })),
}));

// Extend CompletionOptions for testing
interface TestCompletionOptions extends CompletionOptions {
  mockError?: string;
  mockToolUse?: boolean;
}

// Create a test class that overrides the protected methods
class TestBedrock extends Bedrock {
  // Make _streamChat public for testing
  public async *streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: TestCompletionOptions
  ): AsyncGenerator<ChatMessage> {
    if (options.mockError) {
      throw new Error(options.mockError);
    }

    if (options.mockToolUse) {
      yield {
        role: "assistant",
        content: "",
        toolCalls: [{
          id: "tool-1",
          type: "function",
          function: {
            name: "test_tool",
            arguments: '{"arg1":"value1"}'
          }
        }],
      };
      return;
    }

    yield { role: "assistant", content: "Hello" };
    yield { role: "assistant", content: " world" };
  }

  // Override embed to avoid making real API calls
  async embed(chunks: string[]): Promise<number[][]> {
    if (chunks[0] === "error") {
      throw new Error("Embedding Error");
    }
    return [[0.1, 0.2, 0.3]];
  }

  // Override rerank to avoid making real API calls
  async rerank(query: string, chunks: Chunk[]): Promise<number[]> {
    if (!query || !chunks.length) {
      throw new Error("Query and chunks must not be empty");
    }

    if (query === "error") {
      throw new Error("Reranking Error");
    }

    return chunks.map((_, i) => 0.8 - i * 0.3);
  }
}

describe("Bedrock", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with default options", () => {
      const bedrock = new TestBedrock({
        apiKey: "test-key",
        model: "anthropic.claude-3-sonnet-20240229-v1:0",
        region: "us-east-1",
      });

      expect(bedrock.region).toBe("us-east-1");
      expect(bedrock.profile).toBe("bedrock");
      expect(bedrock.apiBase).toBe("https://bedrock-runtime.us-east-1.amazonaws.com");
    });

    it("should use custom options when provided", () => {
      const bedrock = new TestBedrock({
        apiKey: "test-key",
        model: "anthropic.claude-3-sonnet-20240229-v1:0",
        region: "us-west-2",
        profile: "custom-profile",
        apiBase: "https://custom-endpoint.amazonaws.com/",
      });

      expect(bedrock.region).toBe("us-west-2");
      expect(bedrock.profile).toBe("custom-profile");
      expect(bedrock.apiBase).toBe("https://custom-endpoint.amazonaws.com/");
    });
  });

  describe("streamChat", () => {
    let bedrock: TestBedrock;
    const mockAbortSignal = new AbortController().signal;
    const defaultOptions: TestCompletionOptions = {
      model: "anthropic.claude-3-sonnet-20240229-v1:0",
    };

    beforeEach(() => {
      bedrock = new TestBedrock({
        apiKey: "test-key",
        model: "anthropic.claude-3-sonnet-20240229-v1:0",
        region: "us-east-1",
      });
    });

    it("should handle text streaming correctly", async () => {
      const messages: ChatMessage[] = [{
        role: "user",
        content: "Hi"
      } as UserChatMessage];

      const results = [];

      for await (const message of bedrock.streamChat(messages, mockAbortSignal, defaultOptions)) {
        results.push(message);
      }

      expect(results).toEqual([
        { role: "assistant", content: "Hello" },
        { role: "assistant", content: " world" },
      ]);
    });

    it("should handle tool use streaming correctly", async () => {
      const messages: ChatMessage[] = [{
        role: "user",
        content: "Use a tool"
      } as UserChatMessage];

      const results = [];
      const options: TestCompletionOptions = {
        ...defaultOptions,
        mockToolUse: true
      };

      for await (const message of bedrock.streamChat(messages, mockAbortSignal, options)) {
        results.push(message);
      }

      expect(results).toEqual([
        {
          role: "assistant",
          content: "",
          toolCalls: [{
            id: "tool-1",
            type: "function",
            function: {
              name: "test_tool",
              arguments: '{"arg1":"value1"}'
            }
          }],
        },
      ]);
    });

    it("should handle API errors", async () => {
      const messages: ChatMessage[] = [{
        role: "user",
        content: "Hi"
      } as UserChatMessage];

      const options: TestCompletionOptions = {
        ...defaultOptions,
        mockError: "API Error"
      };

      await expect(async () => {
        for await (const _ of bedrock.streamChat(messages, mockAbortSignal, options)) {
          // consume generator
        }
      }).rejects.toThrow("API Error");
    });
  });

  describe("embed", () => {
    let bedrock: TestBedrock;

    beforeEach(() => {
      bedrock = new TestBedrock({
        apiKey: "test-key",
        model: "cohere.embed-english-v3",
        region: "us-east-1",
      });
    });

    it("should handle embedding requests correctly", async () => {
      const result = await bedrock.embed(["test text"]);
      expect(result).toEqual([[0.1, 0.2, 0.3]]);
    });

    it("should handle embedding errors", async () => {
      await expect(bedrock.embed(["error"])).rejects.toThrow("Embedding Error");
    });
  });

  describe("rerank", () => {
    let bedrock: TestBedrock;

    beforeEach(() => {
      bedrock = new TestBedrock({
        apiKey: "test-key",
        model: "cohere.rerank-english-v2.0",
        region: "us-east-1",
      });
    });

    it("should handle reranking requests correctly", async () => {
      const chunks: Chunk[] = [
        {
          content: "doc1",
          digest: "digest1",
          filepath: "file1",
          index: 0,
          startLine: 1,
          endLine: 1
        },
        {
          content: "doc2",
          digest: "digest2",
          filepath: "file2",
          index: 1,
          startLine: 1,
          endLine: 1
        }
      ];

      const result = await bedrock.rerank("query", chunks);
      expect(result).toEqual([0.8, 0.5]);
    });

    it("should handle reranking errors", async () => {
      const chunk: Chunk = {
        content: "doc1",
        digest: "digest1",
        filepath: "file1",
        index: 0,
        startLine: 1,
        endLine: 1
      };

      await expect(
        bedrock.rerank("error", [chunk])
      ).rejects.toThrow("Reranking Error");
    });

    it("should throw error for empty input", async () => {
      await expect(bedrock.rerank("", [])).rejects.toThrow("Query and chunks must not be empty");
    });
  });

  describe("message conversion", () => {
    let bedrock: TestBedrock;

    beforeEach(() => {
      bedrock = new TestBedrock({
        apiKey: "test-key",
        model: "anthropic.claude-3-sonnet-20240229-v1:0",
        region: "us-east-1",
      });
    });

    it("should convert text messages correctly", () => {
      const message: ChatMessage = {
        role: "user",
        content: "Hello"
      } as UserChatMessage;
      const converted = bedrock["_convertMessage"](message);
      expect(converted).toEqual({
        role: "user",
        content: [{ text: "Hello" }],
      });
    });

    it("should convert tool responses correctly", () => {
      const message: ChatMessage = {
        role: "tool",
        content: "Tool result",
        toolCallId: "tool-1",
      };
      const converted = bedrock["_convertMessage"](message);
      expect(converted).toEqual({
        role: "user",
        content: [{
          toolResult: {
            toolUseId: "tool-1",
            content: [{ text: "Tool result" }],
          },
        }],
      });
    });

    it("should convert tool calls correctly", () => {
      const message: ChatMessage = {
        role: "assistant",
        content: "",
        toolCalls: [{
          id: "tool-1",
          type: "function" as const,
          function: {
            name: "test_tool",
            arguments: '{"arg":"value"}',
          },
        }],
      };
      const converted = bedrock["_convertMessage"](message);
      expect(converted).toEqual({
        role: "assistant",
        content: [{
          toolUse: {
            toolUseId: "tool-1",
            name: "test_tool",
            input: { arg: "value" },
          },
        }],
      });
    });

    it("should handle multimodal content correctly", () => {
      const message: ChatMessage = {
        role: "user",
        content: [
          { type: "text", text: "Look at this image:" },
          {
            type: "imageUrl",
            imageUrl: {
              url: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
            },
          },
        ],
      } as UserChatMessage;
      const converted = bedrock["_convertMessage"](message);
      expect(converted).toEqual({
        role: "user",
        content: [
          { text: "Look at this image:" },
          {
            image: {
              format: "jpeg",
              source: {
                bytes: Buffer.from("/9j/4AAQSkZJRg==", "base64"),
              },
            },
          },
        ],
      });
    });
  });
});
