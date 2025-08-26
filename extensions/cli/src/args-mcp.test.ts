import { beforeEach, describe, expect, it } from "vitest";

import { parseArgs } from "./args.js";

describe("parseArgs --mcp flag", () => {
  beforeEach(() => {
    // Clear process.argv before each test
    process.argv = ["node", "test"];
  });

  it("should parse single MCP from --mcp flag", () => {
    process.argv = ["node", "test", "--mcp", "my-org/my-mcp"];
    const result = parseArgs();
    expect(result.mcps).toEqual(["my-org/my-mcp"]);
  });

  it("should parse multiple MCPs from multiple --mcp flags", () => {
    process.argv = ["node", "test", "--mcp", "org1/mcp1", "--mcp", "org2/mcp2"];
    const result = parseArgs();
    expect(result.mcps).toEqual(["org1/mcp1", "org2/mcp2"]);
  });

  it("should handle MCP flag with other flags", () => {
    process.argv = [
      "node",
      "test",
      "--config",
      "my-config.yaml",
      "--mcp",
      "my-org/my-mcp",
      "--org",
      "test-org",
    ];
    const result = parseArgs();
    expect(result.configPath).toBe("my-config.yaml");
    expect(result.mcps).toEqual(["my-org/my-mcp"]);
    expect(result.organizationSlug).toBe("test-org");
  });

  it("should handle MCP flag with prompt", () => {
    process.argv = ["node", "test", "--mcp", "my-org/my-mcp", "hello world"];
    const result = parseArgs();
    expect(result.mcps).toEqual(["my-org/my-mcp"]);
    expect(result.prompt).toBe("hello world");
  });

  it("should ignore MCP and rule flag values when extracting prompt", () => {
    process.argv = [
      "node",
      "test",
      "actual prompt",
      "--rule",
      "my-rule",
      "--mcp",
      "my-org/my-mcp",
    ];
    const result = parseArgs();
    expect(result.prompt).toBe("actual prompt");
    expect(result.rules).toEqual(["my-rule"]);
    expect(result.mcps).toEqual(["my-org/my-mcp"]);
  });

  it("should handle MCP flag without value", () => {
    process.argv = ["node", "test", "--mcp"];
    const result = parseArgs();
    expect(result.mcps).toEqual([]);
  });

  it("should handle MCP flag at the end without value", () => {
    process.argv = ["node", "test", "my prompt", "--mcp"];
    const result = parseArgs();
    expect(result.prompt).toBe("my prompt");
    expect(result.mcps).toEqual([]);
  });
});
