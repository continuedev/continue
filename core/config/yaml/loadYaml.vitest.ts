import {
  AssistantUnrolledNonNullable,
  validateConfigYaml,
} from "@continuedev/config-yaml";
import { describe, expect, it } from "vitest";
import { convertYamlMcpConfigToInternalMcpOptions } from "./yamlToContinueConfig";

describe("MCP Server cwd configuration", () => {
  describe("YAML schema validation", () => {
    it("should accept valid MCP server with cwd", () => {
      const config: AssistantUnrolledNonNullable = {
        name: "test-agent",
        version: "1.0.0",
        mcpServers: [
          {
            name: "test-server",
            command: "node",
            args: ["server.js"],
            env: { NODE_ENV: "production" },
            cwd: "/path/to/project",
            connectionTimeout: 5000,
          },
        ],
      };

      const errors = validateConfigYaml(config);
      expect(errors).toHaveLength(0);
    });

    it("should accept MCP server without cwd", () => {
      const config: AssistantUnrolledNonNullable = {
        name: "test-agent",
        version: "1.0.0",
        mcpServers: [
          {
            name: "test-server",
            command: "python",
            args: ["-m", "server"],
          },
        ],
      };

      const errors = validateConfigYaml(config);
      expect(errors).toHaveLength(0);
    });

    it("should accept relative paths in cwd", () => {
      const config: AssistantUnrolledNonNullable = {
        name: "test-agent",
        version: "1.0.0",
        mcpServers: [
          {
            name: "test-server",
            command: "cargo",
            args: ["run"],
            cwd: "./rust-project",
          },
        ],
      };

      const errors = validateConfigYaml(config);
      expect(errors).toHaveLength(0);
    });

    it("should accept empty string cwd", () => {
      const config: AssistantUnrolledNonNullable = {
        name: "test-agent",
        version: "1.0.0",
        mcpServers: [
          {
            name: "test-server",
            command: "deno",
            args: ["run", "server.ts"],
            cwd: "",
          },
        ],
      };

      const errors = validateConfigYaml(config);
      expect(errors).toHaveLength(0);
    });
  });

  describe("MCP server configuration examples", () => {
    it("should support common MCP server patterns with cwd", () => {
      const configs = [
        {
          name: "Local project MCP server",
          server: {
            name: "project-mcp",
            command: "npm",
            args: ["run", "mcp-server"],
            cwd: "/Users/developer/my-project",
          },
        },
        {
          name: "Python MCP with virtual environment",
          server: {
            name: "python-mcp",
            command: "python",
            args: ["-m", "my_mcp_server"],
            env: { PYTHONPATH: "./src" },
            cwd: "/home/user/python-project",
          },
        },
        {
          name: "Relative path MCP server",
          server: {
            name: "relative-mcp",
            command: "node",
            args: ["index.js"],
            cwd: "../mcp-servers/filesystem",
          },
        },
      ];

      configs.forEach(({ name, server }) => {
        const config: AssistantUnrolledNonNullable = {
          name: "test-agent",
          version: "1.0.0",
          mcpServers: [server],
        };

        const errors = validateConfigYaml(config);
        expect(errors).toHaveLength(0);
      });
    });
  });
});

describe("convertYamlMcpConfigToInternalMcpOptions", () => {
  it("does not inherit global verifySsl false into remote MCP request options", () => {
    const result = convertYamlMcpConfigToInternalMcpOptions(
      {
        name: "remote",
        type: "sse",
        url: "https://mcp.example.com",
      },
      {
        verifySsl: false,
        headers: {
          "X-Test": "1",
        },
        proxy: "https://proxy.example.com",
      },
    );

    expect("requestOptions" in result).toBe(true);
    expect(result.requestOptions).toEqual({
      headers: {
        "X-Test": "1",
      },
      proxy: "https://proxy.example.com",
    });
    expect(result.requestOptions?.verifySsl).toBeUndefined();
    expect(result.requestOptions).not.toHaveProperty("verifySsl");
  });

  it("does not inherit global verifySsl false into streamable HTTP MCP options", () => {
    const result = convertYamlMcpConfigToInternalMcpOptions(
      {
        name: "remote",
        type: "streamable-http",
        url: "https://mcp.example.com",
      },
      {
        verifySsl: false,
        timeout: 30,
      },
    );

    expect("requestOptions" in result).toBe(true);
    expect(result.requestOptions).toEqual({
      timeout: 30,
    });
    expect(result.requestOptions).not.toHaveProperty("verifySsl");
  });

  it("preserves explicit per-server verifySsl false", () => {
    const result = convertYamlMcpConfigToInternalMcpOptions(
      {
        name: "remote",
        type: "sse",
        url: "https://mcp.example.com",
        requestOptions: {
          verifySsl: false,
        },
      },
      {
        verifySsl: false,
      },
    );

    expect("requestOptions" in result).toBe(true);
    expect(result.requestOptions?.verifySsl).toBe(false);
  });

  it("preserves explicit per-server verifySsl true", () => {
    const result = convertYamlMcpConfigToInternalMcpOptions(
      {
        name: "remote",
        type: "streamable-http",
        url: "https://mcp.example.com",
        requestOptions: {
          verifySsl: true,
        },
      },
      {
        verifySsl: false,
      },
    );

    expect("requestOptions" in result).toBe(true);
    expect(result.requestOptions?.verifySsl).toBe(true);
  });

  it("returns no request options when only global verifySsl is set", () => {
    const result = convertYamlMcpConfigToInternalMcpOptions(
      {
        name: "remote",
        type: "sse",
        url: "https://mcp.example.com",
      },
      {
        verifySsl: false,
      },
    );

    expect("requestOptions" in result).toBe(true);
    expect(result.requestOptions).toBeUndefined();
  });
});
