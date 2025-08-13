import type { AssistantUnrolled } from "@continuedev/config-yaml";
import { vi } from "vitest";

import { MockApiClient } from "./mocks/MockApiClient.js";
import { MockLlmApi } from "./mocks/MockLlmApi.js";
import { MockMCPService } from "./mocks/MockMCPService.js";

// Re-export the mocks for backward compatibility
export { MockApiClient, MockLlmApi, MockMCPService };

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

// Add a dummy test to satisfy Vitest requirement
describe("TUIChat setup", () => {
  test("setup should export required functions", () => {
    expect(createProps).toBeDefined();
    expect(mockAssistant).toBeDefined();
  });
});
