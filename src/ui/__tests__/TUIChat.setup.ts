import type { AssistantUnrolled } from "@continuedev/config-yaml";
import { vi } from "vitest";

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

// Mock glob function with files that actually exist in the repository
vi.mock("glob", () => ({
  glob: vi
    .fn<any>()
    .mockResolvedValue([
      ".env.example",
      ".gitignore",
      "AGENTS.md",
      "CHANGELOG.md",
      "README.md",
      "package.json",
      "src/index.ts",
      "src/types.ts",
      "LICENSE",
      "test-file.txt",
    ]),
}));

// Mock API Client
export class MockApiClient {
  async getFreeTrialStatus() {
    return {
      optedInToFreeTrial: true,
      chatCount: 5,
      chatLimit: 100,
    };
  }
  async listAssistants() {
    return [];
  }
  async getAssistant() {
    return { configResult: { config: mockAssistant } };
  }
  async listOrganizations() {
    return { organizations: [] };
  }
  async syncSecrets() {
    return [];
  }
}

export const createProps = (overrides: any = {}) => ({
  config: mockAssistant,
  model: "test-model",
  llmApi: new MockLlmApi(),
  mcpService: new MockMCPService(),
  apiClient: new MockApiClient(),
  configPath: undefined,
  initialPrompt: undefined,
  resume: false,
  additionalRules: [],
  ...overrides,
});

// Add a dummy test to satisfy Jest requirement
describe("TUIChat setup", () => {
  test("setup should export required functions", () => {
    expect(createProps).toBeDefined();
    expect(mockAssistant).toBeDefined();
  });
});
