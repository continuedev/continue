import {
  converMcpServersJsonConfigFileToYamlBlocks,
  convertJsonMcpConfigToYamlMcpConfig,
  convertYamlMcpConfigToJsonMcpConfig,
} from "./convertJson.js";
import type { HttpMcpServer, SseMcpServer, StdioMcpServer } from "./index.js";
import {
  mcpServerConfigFileSchema,
  mcpServersJsonSchema,
  type HttpMcpJsonConfig,
  type McpServersJsonConfigFile,
  type SseMcpJsonConfig,
  type StdioMcpJsonConfig,
} from "./json.js";

describe("convertJsonMcpConfigToYamlMcpConfig", () => {
  describe("STDIO configurations", () => {
    test("converts basic stdio config", () => {
      const jsonConfig: StdioMcpJsonConfig = {
        command: "node",
        args: ["server.js"],
      };

      const result = convertJsonMcpConfigToYamlMcpConfig(
        "test-server",
        jsonConfig,
      );

      expect(result.yamlConfig).toEqual({
        name: "test-server",
        type: "stdio",
        command: "node",
        args: ["server.js"],
      });
      expect(result.warnings).toHaveLength(0);
    });

    test("converts stdio config with all fields", () => {
      const jsonConfig: StdioMcpJsonConfig = {
        type: "stdio",
        command: "python",
        args: ["-m", "server"],
        env: {
          API_KEY: "test-key",
          DEBUG: "true",
        },
      };

      const result = convertJsonMcpConfigToYamlMcpConfig(
        "python-server",
        jsonConfig,
      );

      expect(result.yamlConfig).toEqual({
        name: "python-server",
        type: "stdio",
        command: "python",
        args: ["-m", "server"],
        env: {
          API_KEY: "test-key",
          DEBUG: "true",
        },
      });
      expect(result.warnings).toHaveLength(0);
    });

    test("warns about unsupported envFile", () => {
      const jsonConfig: StdioMcpJsonConfig = {
        command: "node",
        args: ["server.js"],
        envFile: ".env",
      };

      const result = convertJsonMcpConfigToYamlMcpConfig(
        "env-server",
        jsonConfig,
      );

      expect(result.yamlConfig).toEqual({
        name: "env-server",
        type: "stdio",
        command: "node",
        args: ["server.js"],
      });
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("envFile is not supported");
    });

    test("converts stdio config from parsed JSON string", () => {
      const jsonString = JSON.stringify({
        command: "deno",
        args: ["run", "server.ts"],
        env: { PORT: "3000" },
      });
      const parsed = mcpServersJsonSchema.parse(JSON.parse(jsonString));

      const result = convertJsonMcpConfigToYamlMcpConfig("deno-server", parsed);

      expect(result.yamlConfig).toEqual({
        name: "deno-server",
        type: "stdio",
        command: "deno",
        args: ["run", "server.ts"],
        env: { PORT: "3000" },
      });
    });
  });

  describe("SSE/HTTP configurations", () => {
    test("converts basic SSE config", () => {
      const jsonConfig: SseMcpJsonConfig = {
        url: "https://api.example.com/sse",
      };

      const result = convertJsonMcpConfigToYamlMcpConfig(
        "sse-server",
        jsonConfig,
      );

      expect(result.yamlConfig).toEqual({
        name: "sse-server",
        url: "https://api.example.com/sse",
      });
      expect(result.warnings).toHaveLength(0);
    });

    test("converts SSE config with type and headers", () => {
      const jsonConfig: SseMcpJsonConfig = {
        type: "sse",
        url: "https://api.example.com/sse",
        headers: {
          Authorization: "Bearer token",
          "X-Custom-Header": "value",
        },
      };

      const result = convertJsonMcpConfigToYamlMcpConfig(
        "sse-auth",
        jsonConfig,
      );

      expect(result.yamlConfig).toEqual({
        name: "sse-auth",
        type: "sse",
        url: "https://api.example.com/sse",
        requestOptions: {
          headers: {
            Authorization: "Bearer token",
            "X-Custom-Header": "value",
          },
        },
      });
      expect(result.warnings).toHaveLength(0);
    });

    test("converts HTTP config", () => {
      const jsonConfig: HttpMcpJsonConfig = {
        type: "http",
        url: "https://api.example.com/http",
        headers: {
          "Content-Type": "application/json",
        },
      };

      const result = convertJsonMcpConfigToYamlMcpConfig(
        "http-server",
        jsonConfig,
      );

      expect(result.yamlConfig).toEqual({
        name: "http-server",
        type: "streamable-http",
        url: "https://api.example.com/http",
        requestOptions: {
          headers: {
            "Content-Type": "application/json",
          },
        },
      });
      expect(result.warnings).toHaveLength(0);
    });

    test("converts HTTP config from parsed JSON string", () => {
      const jsonString = JSON.stringify({
        type: "http",
        url: "https://test.com/api",
        headers: { "API-Key": "secret" },
      });
      const parsed = mcpServersJsonSchema.parse(JSON.parse(jsonString));

      const result = convertJsonMcpConfigToYamlMcpConfig("parsed-http", parsed);

      expect(result.yamlConfig).toEqual({
        name: "parsed-http",
        type: "streamable-http",
        url: "https://test.com/api",
        requestOptions: {
          headers: { "API-Key": "secret" },
        },
      });
    });
  });

  test("throws error for invalid config", () => {
    const invalidConfig = {
      invalid: "config",
    } as any;

    expect(() =>
      convertJsonMcpConfigToYamlMcpConfig("invalid", invalidConfig),
    ).toThrowError("Invalid MCP server configuration");
  });
});

describe("convertYamlMcpConfigToJsonMcpConfig", () => {
  describe("STDIO configurations", () => {
    test("converts basic stdio config", () => {
      const yamlConfig: StdioMcpServer = {
        name: "test-server",
        type: "stdio",
        command: "node",
        args: ["server.js"],
      };

      const result = convertYamlMcpConfigToJsonMcpConfig(yamlConfig);

      expect(result.name).toBe("test-server");
      expect(result.jsonConfig).toEqual({
        type: "stdio",
        command: "node",
        args: ["server.js"],
      });
      expect(result.MCP_TIMEOUT).toBeUndefined();
      expect(result.warnings).toHaveLength(0);
    });

    test("converts stdio config with env and timeout", () => {
      const yamlConfig: StdioMcpServer = {
        name: "python-server",
        command: "python",
        args: ["-m", "server"],
        env: {
          API_KEY: "test-key",
          DEBUG: "true",
        },
        connectionTimeout: 30000,
      };

      const result = convertYamlMcpConfigToJsonMcpConfig(yamlConfig);

      expect(result.name).toBe("python-server");
      expect(result.jsonConfig).toEqual({
        type: "stdio",
        command: "python",
        args: ["-m", "server"],
        env: {
          API_KEY: "test-key",
          DEBUG: "true",
        },
      });
      expect(result.MCP_TIMEOUT).toBe("30000");
      expect(result.warnings).toHaveLength(0);
    });

    test("warns about unsupported cwd field", () => {
      const yamlConfig: StdioMcpServer = {
        name: "cwd-server",
        command: "node",
        cwd: "/path/to/dir",
      };

      const result = convertYamlMcpConfigToJsonMcpConfig(yamlConfig);

      expect(result.jsonConfig).toEqual({
        type: "stdio",
        command: "node",
      });
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toBe(
        "`cwd` from YAML MCP config not supported in Claude-style JSON, will be removed from server cwd-server",
      );
    });

    test("warns about unsupported faviconUrl", () => {
      const yamlConfig: StdioMcpServer = {
        name: "icon-server",
        command: "node",
        faviconUrl: "https://example.com/icon.png",
      };

      const result = convertYamlMcpConfigToJsonMcpConfig(yamlConfig);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toBe(
        "`faviconUrl` from YAML MCP config not supported in Claude-style JSON, will be removed from server icon-server",
      );
    });

    test("converts parsed YAML stdio config", () => {
      const yamlConfig: StdioMcpServer = {
        name: "parsed-stdio",
        type: "stdio",
        command: "bun",
        args: ["run", "server.ts"],
        env: { NODE_ENV: "production" },
      };

      const result = convertYamlMcpConfigToJsonMcpConfig(yamlConfig);

      expect(result.jsonConfig).toEqual({
        type: "stdio",
        command: "bun",
        args: ["run", "server.ts"],
        env: { NODE_ENV: "production" },
      });
    });
  });

  describe("SSE/HTTP configurations", () => {
    test("converts basic SSE config", () => {
      const yamlConfig: SseMcpServer = {
        name: "sse-server",
        url: "https://api.example.com/sse",
      };

      const result = convertYamlMcpConfigToJsonMcpConfig(yamlConfig);

      expect(result.name).toBe("sse-server");
      expect(result.jsonConfig).toEqual({
        url: "https://api.example.com/sse",
      });
      expect(result.warnings).toHaveLength(0);
    });

    test("converts SSE config with type and headers", () => {
      const yamlConfig: SseMcpServer = {
        name: "sse-auth",
        type: "sse",
        url: "https://api.example.com/sse",
        requestOptions: {
          headers: {
            Authorization: "Bearer token",
            "X-Custom-Header": "value",
          },
        },
      };

      const result = convertYamlMcpConfigToJsonMcpConfig(yamlConfig);

      expect(result.jsonConfig).toEqual({
        type: "sse",
        url: "https://api.example.com/sse",
        headers: {
          Authorization: "Bearer token",
          "X-Custom-Header": "value",
        },
      });
      expect(result.warnings).toHaveLength(0);
    });

    test("converts HTTP config", () => {
      const yamlConfig: HttpMcpServer = {
        name: "http-server",
        type: "streamable-http",
        url: "https://api.example.com/http",
        requestOptions: {
          headers: {
            "Content-Type": "application/json",
          },
        },
      };

      const result = convertYamlMcpConfigToJsonMcpConfig(yamlConfig);

      expect(result.jsonConfig).toEqual({
        type: "http",
        url: "https://api.example.com/http",
        headers: {
          "Content-Type": "application/json",
        },
      });
      expect(result.warnings).toHaveLength(0);
    });

    test("warns about unsupported requestOptions fields", () => {
      const yamlConfig: SseMcpServer = {
        name: "complex-server",
        url: "https://api.example.com",
        requestOptions: {
          headers: { "API-Key": "secret" },
          timeout: 5000,
          proxy: "http://proxy.com",
          verifySsl: false,
        },
      };

      const result = convertYamlMcpConfigToJsonMcpConfig(yamlConfig);

      expect(result.jsonConfig).toEqual({
        url: "https://api.example.com",
        headers: { "API-Key": "secret" },
      });
      expect(result.warnings).toHaveLength(3);
      expect(result.warnings).toContain(
        "timeout requestOption from YAML MCP config not supported in Claude-style JSON, will be ignored in server complex-server",
      );
      expect(result.warnings).toContain(
        "proxy requestOption from YAML MCP config not supported in Claude-style JSON, will be ignored in server complex-server",
      );
      expect(result.warnings).toContain(
        "verifySsl requestOption from YAML MCP config not supported in Claude-style JSON, will be ignored in server complex-server",
      );
    });

    test("converts parsed YAML HTTP config", () => {
      const yamlConfig: HttpMcpServer = {
        name: "parsed-http",
        type: "streamable-http",
        url: "https://test.com/api",
        requestOptions: {
          headers: { "API-Key": "secret" },
        },
        connectionTimeout: 10000,
      };

      const result = convertYamlMcpConfigToJsonMcpConfig(yamlConfig);

      expect(result.jsonConfig).toEqual({
        type: "http",
        url: "https://test.com/api",
        headers: { "API-Key": "secret" },
      });
      expect(result.MCP_TIMEOUT).toBe("10000");
    });
  });

  test("throws error for invalid config", () => {
    const invalidConfig = {
      name: "invalid",
      invalid: "config",
    } as any;

    expect(() =>
      convertYamlMcpConfigToJsonMcpConfig(invalidConfig),
    ).toThrowError("Invalid MCP server configuration");
  });
});

describe("converMcpServersJsonConfigFileToYamlBlocks", () => {
  test("converts empty file", () => {
    const jsonFile: McpServersJsonConfigFile = {
      mcpServers: {},
    };

    const result = converMcpServersJsonConfigFileToYamlBlocks(jsonFile);

    expect(result.yamlConfigs).toEqual([]);
    expect(result.warnings).toHaveLength(0);
  });

  test("converts file with multiple servers", () => {
    const jsonFile: McpServersJsonConfigFile = {
      mcpServers: {
        "weather-server": {
          command: "npx",
          args: ["@example/weather-server"],
          env: {
            WEATHER_API_KEY: "key123",
          },
        },
        "database-server": {
          type: "stdio",
          command: "python",
          args: ["-m", "db_server"],
        },
        "api-server": {
          type: "http",
          url: "https://api.example.com",
          headers: {
            Authorization: "Bearer token",
          },
        },
        "sse-server": {
          type: "sse",
          url: "https://sse.example.com/stream",
        },
      },
    };

    const result = converMcpServersJsonConfigFileToYamlBlocks(jsonFile);

    expect(result.yamlConfigs).toHaveLength(4);
    expect(result.warnings).toHaveLength(0);

    // Check each converted server
    expect(result.yamlConfigs[0]).toEqual({
      name: "weather-server",
      type: "stdio",
      command: "npx",
      args: ["@example/weather-server"],
      env: {
        WEATHER_API_KEY: "key123",
      },
    });

    expect(result.yamlConfigs[1]).toEqual({
      name: "database-server",
      type: "stdio",
      command: "python",
      args: ["-m", "db_server"],
    });

    expect(result.yamlConfigs[2]).toEqual({
      name: "api-server",
      type: "streamable-http",
      url: "https://api.example.com",
      requestOptions: {
        headers: {
          Authorization: "Bearer token",
        },
      },
    });

    expect(result.yamlConfigs[3]).toEqual({
      name: "sse-server",
      type: "sse",
      url: "https://sse.example.com/stream",
    });
  });

  test("collects warnings from multiple servers", () => {
    const jsonFile: McpServersJsonConfigFile = {
      mcpServers: {
        server1: {
          command: "node",
          envFile: ".env",
        },
        server2: {
          command: "python",
          args: ["app.py"],
          envFile: ".env.production",
        },
      },
    };

    const result = converMcpServersJsonConfigFileToYamlBlocks(jsonFile);

    expect(result.yamlConfigs).toHaveLength(2);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0]).toContain("server1");
    expect(result.warnings[1]).toContain("server2");
  });

  test("converts parsed JSON file", () => {
    const jsonString = JSON.stringify({
      mcpServers: {
        "test-stdio": {
          command: "node",
          args: ["index.js"],
        },
        "test-http": {
          type: "http",
          url: "https://test.com",
          headers: { "X-Test": "value" },
        },
      },
    });
    const parsed = mcpServerConfigFileSchema.parse(JSON.parse(jsonString));

    const result = converMcpServersJsonConfigFileToYamlBlocks(parsed);

    expect(result.yamlConfigs).toHaveLength(2);
    expect(result.yamlConfigs[0].name).toBe("test-stdio");
    expect(result.yamlConfigs[1].name).toBe("test-http");
  });

  test("handles mixed valid and problematic configurations", () => {
    const jsonFile: McpServersJsonConfigFile = {
      mcpServers: {
        "good-server": {
          command: "node",
          args: ["server.js"],
        },
        "warning-server": {
          command: "python",
          envFile: ".env",
          env: {
            PORT: "3000",
          },
        },
      },
    };

    const result = converMcpServersJsonConfigFileToYamlBlocks(jsonFile);

    expect(result.yamlConfigs).toHaveLength(2);
    expect(result.warnings).toHaveLength(1);

    // Check that both servers were converted
    expect(
      result.yamlConfigs.find((c) => c.name === "good-server"),
    ).toBeTruthy();
    expect(
      result.yamlConfigs.find((c) => c.name === "warning-server"),
    ).toBeTruthy();

    // Check that the warning server still has its env vars
    const warningServer = result.yamlConfigs.find(
      (c) => c.name === "warning-server",
    );
    expect(warningServer).toMatchObject({
      env: { PORT: "3000" },
    });
  });
});
