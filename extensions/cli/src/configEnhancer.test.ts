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

// Mock the service container to provide empty agent file state
vi.mock("./services/ServiceContainer.js", () => ({
  serviceContainer: {
    get: vi.fn(() =>
      Promise.resolve({
        agentFileService: null,
        agentFileModelName: null,
        agentFile: null,
        slug: null,
      }),
    ),
  },
}));

vi.mock("./services/types.js", () => ({
  SERVICE_NAMES: {
    AGENT_FILE: "agentFile",
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
    // Mock loadPackageFromHub to return test MCP (singular call for each MCP)
    const { loadPackageFromHub } = await import("./hubLoader.js");
    (loadPackageFromHub as any).mockResolvedValueOnce({
      name: "New-MCP",
      command: "new-mcp",
    });

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

  it("should handle URLs in --mcp flag as streamable-http servers", async () => {
    // Set up existing MCPs in config
    mockConfig.mcpServers = [{ name: "Existing-MCP", command: "existing-mcp" }];

    const options: BaseCommandOptions = {
      mcp: ["https://docs.continue.dev/mcp"],
    };

    const config = await enhancer.enhanceConfig(mockConfig, options);

    // URL should be converted to streamable-http MCP configuration
    expect(config.mcpServers).toHaveLength(2);
    expect(config.mcpServers?.[0]).toEqual({
      name: "docs.continue.dev",
      type: "streamable-http",
      url: "https://docs.continue.dev/mcp",
    });
    expect(config.mcpServers?.[1]).toEqual({
      name: "Existing-MCP",
      command: "existing-mcp",
    });
  });

  it("should handle mix of URLs and hub slugs in --mcp flag", async () => {
    // Mock loadPackageFromHub to return test MCP for hub slug
    const { loadPackageFromHub } = await import("./hubLoader.js");
    (loadPackageFromHub as any).mockResolvedValueOnce({
      name: "Hub-MCP",
      command: "hub-mcp",
    });

    const options: BaseCommandOptions = {
      mcp: ["https://example.com/mcp", "test/hub-mcp"],
    };

    const config = await enhancer.enhanceConfig(mockConfig, options);

    expect(config.mcpServers).toHaveLength(2);
    expect(config.mcpServers?.[0]).toEqual({
      name: "example.com",
      type: "streamable-http",
      url: "https://example.com/mcp",
    });
    expect(config.mcpServers?.[1]).toEqual({
      name: "Hub-MCP",
      command: "hub-mcp",
    });
  });

  it("should handle http:// URLs in --mcp flag", async () => {
    const options: BaseCommandOptions = {
      mcp: ["http://localhost:8080/mcp"],
    };

    const config = await enhancer.enhanceConfig(mockConfig, options);

    expect(config.mcpServers).toHaveLength(1);
    expect(config.mcpServers?.[0]).toEqual({
      name: "localhost",
      type: "streamable-http",
      url: "http://localhost:8080/mcp",
    });
  });

  it("should handle agent file integration gracefully when no agent file", async () => {
    // The mocked service container returns null agent file state
    const options: BaseCommandOptions = {
      rule: ["test-rule"],
    };

    const config = await enhancer.enhanceConfig(mockConfig, options);

    // Should work normally when no agent file is active
    expect(config.rules).toEqual(["test-rule"]);
  });

  it("should handle agent file integration when agent file is active", async () => {
    // Mock service container to return active agent file
    const options: BaseCommandOptions = {
      rule: ["user-rule"],
      prompt: ["user-prompt"],
    };

    const config = await enhancer.enhanceConfig(mockConfig, options, {
      agentFile: {
        name: "Test Agent",
        prompt: "You are a test assistant",
        rules: "Always be helpful",
        model: "gpt-4",
        tools: "bash,read",
      },
      slug: "owner/test-agent",
      agentFileModelName: null,
      agentFileService: null,
    });

    // Should have both agent file and user rules
    expect(config.rules).toHaveLength(2);
    expect(config.rules?.[0]).toBe("Always be helpful"); // Agent file rule first
    expect(config.rules?.[1]).toBe("user-rule"); // User rule second
  });
});
