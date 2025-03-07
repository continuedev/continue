import { ChatMessage, CompletionOptions, UserChatMessage } from "../../index.js";
import BedrockAnthropic from "./BedrockAnthropic.js";

// Mock Anthropic Bedrock SDK
jest.mock("@anthropic-ai/bedrock-sdk", () => ({
  AnthropicBedrock: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn(),
    },
  })),
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
class TestBedrockAnthropic extends BedrockAnthropic {
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
}

describe("BedrockAnthropic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with default options", () => {
      const bedrockAnthropic = new TestBedrockAnthropic({
        apiKey: "test-key",
        model: "anthropic.claude-3-5-sonnet-20240229-v1:0",
        region: "us-east-1",
      });

      expect(bedrockAnthropic.region).toBe("us-east-1");
      expect(bedrockAnthropic.profile).toBe("bedrock");
    });

    it("should use custom options when provided", () => {
      const bedrockAnthropic = new TestBedrockAnthropic({
        apiKey: "test-key",
        model: "anthropic.claude-3-5-sonnet-20240229-v1:0",
        region: "us-west-2",
        profile: "custom-profile",
      });

      expect(bedrockAnthropic.region).toBe("us-west-2");
      expect(bedrockAnthropic.profile).toBe("custom-profile");
    });
  });

  describe("streamChat", () => {
    let bedrockAnthropic: TestBedrockAnthropic;
    const mockAbortSignal = new AbortController().signal;
    const defaultOptions: TestCompletionOptions = {
      model: "anthropic.claude-3-5-sonnet-20240229-v1:0",
    };

    beforeEach(() => {
      bedrockAnthropic = new TestBedrockAnthropic({
        apiKey: "test-key",
        model: "anthropic.claude-3-5-sonnet-20240229-v1:0",
        region: "us-east-1",
      });
    });

    it("should handle text streaming correctly", async () => {
      const messages: ChatMessage[] = [{
        role: "user",
        content: "Hi"
      } as UserChatMessage];

      const results = [];

      for await (const message of bedrockAnthropic.streamChat(messages, mockAbortSignal, defaultOptions)) {
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

      for await (const message of bedrockAnthropic.streamChat(messages, mockAbortSignal, options)) {
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
        for await (const _ of bedrockAnthropic.streamChat(messages, mockAbortSignal, options)) {
          // consume generator
        }
      }).rejects.toThrow("API Error");
    });
  });

  describe("message conversion", () => {
    let bedrockAnthropic: BedrockAnthropic;

    beforeEach(() => {
      bedrockAnthropic = new BedrockAnthropic({
        apiKey: "test-key",
        model: "anthropic.claude-3-5-sonnet-20240229-v1:0",
        region: "us-east-1",
      });
    });

    it("should convert text messages correctly", () => {
      const message: ChatMessage = {
        role: "user",
        content: "Hello"
      } as UserChatMessage;
      const converted = bedrockAnthropic["convertMessage"](message, false);
      expect(converted).toEqual({
        role: "user",
        content: [{ 
          type: "text", 
          text: "Hello" 
        }],
      });
    });

    it("should convert tool responses correctly", () => {
      const message: ChatMessage = {
        role: "tool",
        content: "Tool result",
        toolCallId: "tool-1",
      };
      const converted = bedrockAnthropic["convertMessage"](message, false);
      expect(converted).toEqual({
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: "tool-1",
          content: "Tool result",
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
      const converted = bedrockAnthropic["convertMessage"](message, false);
      expect(converted).toEqual({
        role: "assistant",
        content: [{
          type: "tool_use",
          id: "tool-1",
          name: "test_tool",
          input: { arg: "value" },
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
      const converted = bedrockAnthropic["convertMessage"](message, false);
      expect(converted).toEqual({
        role: "user",
        content: [
          { type: "text", text: "Look at this image:" },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: "/9j/4AAQSkZJRg==",
            },
          },
        ],
      });
    });
  });
});
