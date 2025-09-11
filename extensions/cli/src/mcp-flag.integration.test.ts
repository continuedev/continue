import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseArgs, loadMcpFromHub } from "./args.js";

// Integration test to demonstrate the --mcp flag functionality
describe("--mcp flag integration", () => {
  beforeEach(() => {
    // Clear process.argv before each test
    process.argv = ["node", "test"];
    vi.clearAllMocks();
  });

  it("should demonstrate the complete --mcp flag functionality", () => {
    // Test command line parsing
    process.argv = [
      "node",
      "test",
      "--config",
      "my-config.yaml",
      "--mcp",
      "continuedev/filesystem",
      "--mcp",
      "continuedev/github",
      "hello world",
    ];

    const args = parseArgs();

    // Verify the parsed command line arguments
    expect(args).toEqual({
      configPath: "my-config.yaml",
      mcps: ["continuedev/filesystem", "continuedev/github"],
      prompt: "hello world",
    });

    // Verify MCP slugs are properly captured
    expect(args.mcps).toHaveLength(2);
    expect(args.mcps).toContain("continuedev/filesystem");
    expect(args.mcps).toContain("continuedev/github");
  });

  it("should validate MCP slug format", async () => {
    // Test that invalid slug formats are rejected
    await expect(loadMcpFromHub("invalid-slug")).rejects.toThrow(
      'Invalid hub slug format. Expected "owner/package", got: invalid-slug',
    );

    // Valid format should not throw during validation step
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });
    global.fetch = mockFetch;

    // This will fail at the HTTP level, not validation level
    await expect(loadMcpFromHub("valid/slug")).rejects.toThrow(
      'Failed to load mcp from hub "valid/slug": HTTP 404: Not Found',
    );
  });

  it("should demonstrate MCP flag with other command line options", () => {
    process.argv = [
      "node",
      "test",
      "--config",
      "test-config.yaml",
      "--org",
      "my-org",
      "--rule",
      "my-rule",
      "--mcp",
      "continuedev/filesystem",
      "--allow",
      "readFile",
      "--readonly",
      "analyze this code",
    ];

    const args = parseArgs();

    // Verify all flags are parsed correctly together
    expect(args).toEqual({
      configPath: "test-config.yaml",
      organizationSlug: "my-org",
      rules: ["my-rule"],
      mcps: ["continuedev/filesystem"],
      readonly: true,
      prompt: "analyze this code",
    });
  });
});
