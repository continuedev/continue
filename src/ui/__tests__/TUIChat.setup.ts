import type { AssistantUnrolled } from "@continuedev/config-yaml";
import { jest } from "@jest/globals";

// Minimal mock for LLM API (just enough to prevent errors)
export class MockLlmApi {
  async chatCompletionStream(): Promise<AsyncIterable<any>> {
    return (async function* () {
      yield { choices: [{ delta: {}, index: 0, finish_reason: "stop" }] };
    })();
  }
  async chatCompletionNonStream() {
    throw new Error("Not implemented");
  }
  async completionStream() {
    throw new Error("Not implemented");
  }
  async completionNonStream() {
    throw new Error("Not implemented");
  }
  async streamChat() {
    return this.chatCompletionStream();
  }
  async completions() {
    throw new Error("Not implemented");
  }
  async streamCompletion() {
    throw new Error("Not implemented");
  }
  async chat() {
    throw new Error("Not implemented");
  }
  async rerank() {
    return { results: [] };
  }
  async embed() {
    return { data: [], usage: {} };
  }
  async fimComplete() {
    throw new Error("Not implemented");
  }
}

// Mock MCP Service
export class MockMCPService {
  connections = [];
  assistant = {} as any;
  getTools() {
    return [];
  }
  getPrompts() {
    return [];
  }
  async runTool() {
    return { result: "Mock result" };
  }
  async executeToolCall() {
    return { result: "Mock result" };
  }
  async close() {}
  isInitialized() {
    return true;
  }
}

// Mock Assistant config
export const mockAssistant: AssistantUnrolled = {
  name: "test-assistant",
  models: [
    {
      provider: "openai",
      name: "test-model",
      model: "test-model",
    },
  ],
  systemMessage: "You are a helpful assistant",
  tools: [],
  mcpServers: [],
} as any;

// Mock glob function
jest.mock("glob", () => ({
  glob: jest
    .fn<any>()
    .mockResolvedValue([
      "README.md",
      "package.json",
      "src/index.ts",
      "src/types.ts",
      "LICENSE",
      "CHANGELOG.md",
      "test-file.txt",
    ]),
}));

export const createProps = (overrides: any = {}) => ({
  config: mockAssistant,
  model: "test-model",
  llmApi: new MockLlmApi(),
  mcpService: new MockMCPService(),
  configPath: undefined,
  initialPrompt: undefined,
  resume: false,
  additionalRules: [],
  ...overrides,
});