import React from "react";
import { render } from "ink-testing-library";
import type { ChatCompletionMessageParam } from "openai/resources/index.js";
import type { BaseLlmApi } from "@continuedev/openai-adapters";
import type { AssistantUnrolled } from "@continuedev/config-yaml";
import TUIChat from "./TUIChat.js";
import type { MCPService } from "../mcp.js";

// Helper to create a mock LLM API with predefined conversations
function createMockLlmApi(conversations: Array<{
  trigger: string;
  response: ChatCompletionMessageParam[];
  streamDelay?: number;
}>): BaseLlmApi {
  return {
    async streamChat(body: any, signal?: AbortSignal): Promise<AsyncIterable<any>> {
      const messages = body.messages as ChatCompletionMessageParam[];
      const lastUserMessage = messages.findLast(m => m.role === "user");
      
      if (!lastUserMessage || typeof lastUserMessage.content !== "string") {
        throw new Error("No user message found");
      }

      // Find matching conversation
      const conv = conversations.find(c => lastUserMessage.content.includes(c.trigger));
      if (!conv) {
        return (async function* () {
          yield {
            choices: [{
              delta: { content: "I don't understand." },
              index: 0,
              finish_reason: "stop"
            }]
          };
        })();
      }

      // Stream the responses
      return (async function* () {
        for (const response of conv.response) {
          if (response.role === "assistant" && response.content) {
            // Stream content with delay
            const delay = conv.streamDelay || 5;
            for (const char of response.content) {
              yield {
                choices: [{
                  delta: { content: char },
                  index: 0,
                  finish_reason: null
                }]
              };
              if (delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
              }
            }
          } else if (response.role === "assistant" && response.tool_calls) {
            // Yield tool calls
            for (const toolCall of response.tool_calls) {
              yield {
                choices: [{
                  delta: {
                    tool_calls: [{
                      index: 0,
                      id: toolCall.id,
                      type: "function",
                      function: toolCall.function
                    }]
                  },
                  index: 0,
                  finish_reason: null
                }]
              };
            }
          }
          
          yield {
            choices: [{
              delta: {},
              index: 0,
              finish_reason: "stop"
            }]
          };
        }
      })();
    },
    async completions() { throw new Error("Not implemented"); },
    async streamCompletion() { throw new Error("Not implemented"); },
    async chat() { throw new Error("Not implemented"); },
    async rerank() { throw new Error("Not implemented"); },
    async embed() { throw new Error("Not implemented"); },
    async fimComplete() { throw new Error("Not implemented"); }
  } as BaseLlmApi;
}

// Mock MCP Service
class MockMCPService implements MCPService {
  getTools() { return []; }
  async executeToolCall(toolName: string, args: any) { return { result: "Mock result" }; }
  async close() {}
  isInitialized() { return true; }
}

// Mock Assistant config
const mockAssistant: AssistantUnrolled = {
  name: "test-assistant",
  model: "test-model",
  systemMessage: "You are a helpful assistant",
  tools: [],
  mcpServers: []
};

describe("TUIChat - Advanced Component Tests", () => {
  const createProps = (overrides: any = {}) => ({
    config: mockAssistant,
    model: "test-model",
    llmApi: createMockLlmApi([]),
    mcpService: new MockMCPService(),
    configPath: undefined,
    initialPrompt: undefined,
    resume: false,
    additionalRules: [],
    ...overrides
  });

  describe("Chat History Replay", () => {
    it("replays a conversation and validates component structure", async () => {
      const chatHistory: ChatCompletionMessageParam[] = [
        { role: "user", content: "What is TypeScript?" },
        { role: "assistant", content: "TypeScript is a typed superset of JavaScript." },
        { role: "user", content: "Show me an example" },
        { role: "assistant", content: "Here's a simple example:\n```typescript\nconst greeting: string = 'Hello';\n```" }
      ];

      const mockApi = createMockLlmApi([
        {
          trigger: "What is TypeScript?",
          response: [{ role: "assistant", content: "TypeScript is a typed superset of JavaScript." }]
        },
        {
          trigger: "Show me an example",
          response: [{ 
            role: "assistant", 
            content: "Here's a simple example:\n```typescript\nconst greeting: string = 'Hello';\n```" 
          }]
        }
      ]);

      const { lastFrame } = render(
        <TUIChat {...createProps({ llmApi: mockApi })} />
      );

      // Replay the conversation
      const { stdin } = render(
        <TUIChat {...createProps({ llmApi: mockApi })} />
      );

      // First message
      stdin.write("What is TypeScript?");
      stdin.write("\r");
      await new Promise(resolve => setTimeout(resolve, 200));

      // Second message
      stdin.write("Show me an example");
      stdin.write("\r");
      await new Promise(resolve => setTimeout(resolve, 200));

      const frame = lastFrame();

      // Validate structure
      expect(frame).toContain("●"); // Message indicators
      expect(frame).toContain("What is TypeScript?");
      expect(frame).toContain("TypeScript is a typed superset");
      expect(frame).toContain("Show me an example");
      expect(frame).toContain("```typescript"); // Code block
    });
  });

  describe("Component visibility tests", () => {
    it("shows correct components for tool execution", async () => {
      const mockApi = createMockLlmApi([{
        trigger: "analyze",
        response: [{
          role: "assistant",
          content: null,
          tool_calls: [{
            id: "call_1",
            type: "function" as const,
            function: {
              name: "searchCode",
              arguments: JSON.stringify({ query: "function" })
            }
          }]
        }]
      }]);

      const { lastFrame, stdin } = render(
        <TUIChat {...createProps({ llmApi: mockApi })} />
      );

      stdin.write("analyze code");
      stdin.write("\r");
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const frame = lastFrame();
      
      // Tool execution components
      expect(frame).toContain("○"); // Tool start
      expect(frame).toContain("searchCode");
      expect(frame).toContain("query"); // Tool args
    });

    it("shows markdown formatting components", async () => {
      const mockApi = createMockLlmApi([{
        trigger: "markdown",
        response: [{
          role: "assistant",
          content: "**Bold text** and *italic text* with `inline code`"
        }]
      }]);

      const { lastFrame, stdin } = render(
        <TUIChat {...createProps({ llmApi: mockApi })} />
      );

      stdin.write("show markdown");
      stdin.write("\r");
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const frame = lastFrame();
      
      // The actual rendered output will have ANSI codes for formatting
      // We check for the content being present
      expect(frame).toContain("Bold text");
      expect(frame).toContain("italic text");
      expect(frame).toContain("inline code");
    });
  });

  describe("UI state transitions", () => {
    it("shows loading state during streaming", async () => {
      const mockApi = createMockLlmApi([{
        trigger: "slow",
        response: [{ role: "assistant", content: "This is a very slow response" }],
        streamDelay: 50 // Slow streaming
      }]);

      const { frames, stdin } = render(
        <TUIChat {...createProps({ llmApi: mockApi })} />
      );

      stdin.write("slow response");
      stdin.write("\r");
      
      // Capture frames during streaming
      await new Promise(resolve => setTimeout(resolve, 50));
      const loadingFrame = frames[frames.length - 1];
      
      // Should show loading spinner
      expect(loadingFrame).toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
      
      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 1500));
      const finalFrame = frames[frames.length - 1];
      
      // Should show completed response
      expect(finalFrame).toContain("This is a very slow response");
      expect(finalFrame).not.toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
    });
  });

  describe("Complex chat scenarios", () => {
    it("handles mixed content types in correct order", async () => {
      const mockApi = createMockLlmApi([{
        trigger: "complex",
        response: [
          {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "call_1",
              type: "function" as const,
              function: {
                name: "readFile",
                arguments: JSON.stringify({ path: "test.ts" })
              }
            }]
          },
          {
            role: "assistant",
            content: "I found the file. Here's what it contains:\n```typescript\nexport function test() {}\n```"
          }
        ]
      }]);

      const { lastFrame, stdin } = render(
        <TUIChat {...createProps({ llmApi: mockApi })} />
      );

      stdin.write("complex task");
      stdin.write("\r");
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const frame = lastFrame();
      
      // Verify order: user message, tool call, assistant response
      const lines = frame.split('\n');
      
      // Find relevant lines
      const userLineIndex = lines.findIndex(l => l.includes("complex task"));
      const toolLineIndex = lines.findIndex(l => l.includes("readFile"));
      const codeLineIndex = lines.findIndex(l => l.includes("```typescript"));
      
      // Verify order
      expect(userLineIndex).toBeGreaterThan(-1);
      expect(toolLineIndex).toBeGreaterThan(userLineIndex);
      expect(codeLineIndex).toBeGreaterThan(toolLineIndex);
    });

    it("maintains proper layout with long messages", async () => {
      const longMessage = "This is a very long message that should wrap properly. ".repeat(10);
      
      const mockApi = createMockLlmApi([{
        trigger: "long",
        response: [{ role: "assistant", content: longMessage }]
      }]);

      const { lastFrame, stdin } = render(
        <TUIChat {...createProps({ llmApi: mockApi })} />
      );

      stdin.write("long message test");
      stdin.write("\r");
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const frame = lastFrame();
      
      // Check that the message is present but wrapped
      expect(frame).toContain("This is a very long message");
      
      // Verify box borders are maintained
      expect(frame).toContain("┃"); // Left border
      expect(frame).toContain("┃"); // Right border
    });
  });

  describe("Error handling", () => {
    it("displays error states correctly", async () => {
      // Create an API that throws an error
      const errorApi = {
        ...createMockLlmApi([]),
        async streamChat() {
          throw new Error("API Error");
        }
      } as BaseLlmApi;

      const { lastFrame, stdin } = render(
        <TUIChat {...createProps({ llmApi: errorApi })} />
      );

      stdin.write("trigger error");
      stdin.write("\r");
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const frame = lastFrame();
      
      // Should show error message
      expect(frame).toContain("Error");
    });
  });
});