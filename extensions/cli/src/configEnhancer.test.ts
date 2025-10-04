import { beforeEach, describe, expect, it, vi } from "vitest";

import { BaseCommandOptions } from "./commands/BaseCommandOptions.js";
import { ConfigEnhancer } from "./configEnhancer.js";

// Mock processRule to simulate hub loading
vi.mock("./hubLoader.js", () => ({
  processRule: vi.fn((rule: string) => {
    // Simulate hub slug loading
    if (rule.includes("/") && !rule.startsWith(".") && !rule.startsWith("/")) {
      return Promise.resolve(`Content for ${rule}`);
    }
    // Return as-is for direct content
    return Promise.resolve(rule);
  }),
  loadPackageFromHub: vi.fn(() =>
    Promise.resolve({ name: "test", provider: "test" }),
  ),
  loadPackagesFromHub: vi.fn(() => Promise.resolve([])),
  mcpProcessor: {},
  modelProcessor: {},
}));

// Mock the service container to provide empty workflow state
vi.mock("./services/ServiceContainer.js", () => ({
  serviceContainer: {
    get: vi.fn(() =>
      Promise.resolve({
        workflowService: null,
        workflowModelName: null,
        workflowFile: null,
        workflow: null,
      }),
    ),
  },
}));

vi.mock("./services/types.js", () => ({
  SERVICE_NAMES: {
    WORKFLOW: "workflow",
  },
}));

describe("ConfigEnhancer", () => {
  let enhancer: ConfigEnhancer;
  let mockConfig: any;

  beforeEach(() => {
    enhancer = new ConfigEnhancer();
    mockConfig = {
      name: "test-config",
      version: "1.0.0",
      models: [],
      mcpServers: [],
    } as any;
    vi.clearAllMocks();
  });

  it("should return unchanged config when no enhancements provided", async () => {
    const config = await enhancer.enhanceConfig(mockConfig, {});

    expect(config).toEqual(mockConfig);
  });

  it("should apply rules enhancement", async () => {
    const options: BaseCommandOptions = {
      rule: ["test-rule"],
    };

    const config = await enhancer.enhanceConfig(mockConfig, options);

    expect(config.rules).toEqual(["test-rule"]);
  });

  it("should apply multiple enhancements", async () => {
    const options: BaseCommandOptions = {
      rule: ["rule1", "rule2"],
      mcp: [],
    };

    const config = await enhancer.enhanceConfig(mockConfig, options);

    expect(config.rules).toEqual(["rule1", "rule2"]);
  });

  it("should preserve existing rules when adding new ones", async () => {
    mockConfig.rules = ["existing rule"];
    const options: BaseCommandOptions = {
      rule: ["new rule"],
    };

    const config = await enhancer.enhanceConfig(mockConfig, options);

    expect(config.rules).toEqual(["existing rule", "new rule"]);
  });

  it("should not mutate original config", async () => {
    const originalConfig = { ...mockConfig };
    const options: BaseCommandOptions = {
      rule: ["test-rule"],
    };

    await enhancer.enhanceConfig(mockConfig, options);

    expect(mockConfig).toEqual(originalConfig);
  });

  it("should preserve hub slug as rule name", async () => {
    const options: BaseCommandOptions = {
      rule: ["nate/spanish"],
    };

    const config = await enhancer.enhanceConfig(mockConfig, options);

    expect(config.rules).toHaveLength(1);
    expect(config.rules?.[0]).toEqual({
      name: "nate/spanish",
      rule: "Content for nate/spanish",
    });
  });

  it("should handle mix of hub slugs and direct content", async () => {
    const options: BaseCommandOptions = {
      rule: ["nate/spanish", "Always be helpful", "org/another-rule"],
    };

    const config = await enhancer.enhanceConfig(mockConfig, options);

    expect(config.rules).toHaveLength(3);
    expect(config.rules?.[0]).toEqual({
      name: "nate/spanish",
      rule: "Content for nate/spanish",
    });
    expect(config.rules?.[1]).toBe("Always be helpful");
    expect(config.rules?.[2]).toEqual({
      name: "org/another-rule",
      rule: "Content for org/another-rule",
    });
  });

  it("should treat file paths as plain strings", async () => {
    const options: BaseCommandOptions = {
      rule: ["./rules/my-rule.md", "/absolute/path/rule.txt"],
    };

    const config = await enhancer.enhanceConfig(mockConfig, options);

    expect(config.rules).toHaveLength(2);
    // File paths should be stored as plain strings
    expect(config.rules?.[0]).toBe("./rules/my-rule.md");
    expect(config.rules?.[1]).toBe("/absolute/path/rule.txt");
  });

  it("should prepend models from --model flag to make them default", async () => {
    // Mock loadPackagesFromHub to return test models
    const { loadPackagesFromHub } = await import("./hubLoader.js");
    (loadPackagesFromHub as any).mockResolvedValueOnce([
      { name: "GPT-5", provider: "openai", model: "gpt-5" },
      { name: "Claude-3", provider: "anthropic", model: "claude-3" },
    ]);

    // Set up existing models in config
    mockConfig.models = [
      { name: "GPT-4", provider: "openai", model: "gpt-4" },
      { name: "Claude-2", provider: "anthropic", model: "claude-2" },
    ];

    const options: BaseCommandOptions = {
      model: ["openai/gpt-5", "anthropic/claude-3"],
    };

    const config = await enhancer.enhanceConfig(mockConfig, options);

    // Models from --model flag should be prepended (at the start)
    expect(config.models).toHaveLength(4);
    expect(config.models?.[0]).toEqual({
      name: "GPT-5",
      provider: "openai",
      model: "gpt-5",
    });
    expect(config.models?.[1]).toEqual({
      name: "Claude-3",
      provider: "anthropic",
      model: "claude-3",
    });
    expect(config.models?.[2]).toEqual({
      name: "GPT-4",
      provider: "openai",
      model: "gpt-4",
    });
    expect(config.models?.[3]).toEqual({
      name: "Claude-2",
      provider: "anthropic",
      model: "claude-2",
    });
  });

  it("should prepend MCPs from --mcp flag", async () => {
    // Mock loadPackagesFromHub to return test MCPs
    const { loadPackagesFromHub } = await import("./hubLoader.js");
    (loadPackagesFromHub as any).mockResolvedValueOnce([
      { name: "New-MCP", command: "new-mcp" },
    ]);

    // Set up existing MCPs in config
    mockConfig.mcpServers = [{ name: "Existing-MCP", command: "existing-mcp" }];

    const options: BaseCommandOptions = {
      mcp: ["test/new-mcp"],
    };

    const config = await enhancer.enhanceConfig(mockConfig, options);

    // MCPs from --mcp flag should be prepended (at the start)
    expect(config.mcpServers).toHaveLength(2);
    expect(config.mcpServers?.[0]).toEqual({
      name: "New-MCP",
      command: "new-mcp",
    });
    expect(config.mcpServers?.[1]).toEqual({
      name: "Existing-MCP",
      command: "existing-mcp",
    });
  });

  it("should handle workflow integration gracefully when no workflow", async () => {
    // The mocked service container returns null workflow state
    const options: BaseCommandOptions = {
      rule: ["test-rule"],
    };

    const config = await enhancer.enhanceConfig(mockConfig, options);

    // Should work normally when no workflow is active
    expect(config.rules).toEqual(["test-rule"]);
  });

  it("should handle workflow integration when workflow is active", async () => {
    // Mock service container to return active workflow
    const options: BaseCommandOptions = {
      rule: ["user-rule"],
      prompt: ["user-prompt"],
    };

    const config = await enhancer.enhanceConfig(mockConfig, options, {
      workflowFile: {
        name: "Test Workflow",
        prompt: "You are a test assistant",
        rules: "Always be helpful",
        model: "gpt-4",
        tools: "bash,read",
      },
      slug: "owner/test-workflow",
      workflowModelName: null,
      workflowService: null,
    });

    // Should have both workflow and user rules
    expect(config.rules).toHaveLength(2);
    expect(config.rules?.[0]).toBe("Always be helpful"); // Workflow rule first
    expect(config.rules?.[1]).toBe("user-rule"); // User rule second
  });
});
