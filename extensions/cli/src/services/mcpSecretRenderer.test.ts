import {
  MCPServer,
  SseMcpServer,
  StdioMcpServer,
} from "@continuedev/config-yaml";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSecretVariables,
  hasUnrenderedSecrets,
  renderMcpServerEnv,
  renderMcpServerHeaders,
  renderMcpServerSecrets,
  renderMcpServersSecrets,
  renderSecretsFromEnv,
  validateMcpServerSecretsRendered,
} from "./mcpSecretRenderer.js";

describe("mcpSecretRenderer", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetAllMocks();
    // Reset process.env
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getSecretVariables", () => {
    it("should extract secret variable names from template strings", () => {
      const template = "Bearer ${{ secrets.API_KEY }}";
      const result = getSecretVariables(template);
      expect(result).toEqual(["API_KEY"]);
    });

    it("should extract multiple secret variables", () => {
      const template = "${{ secrets.USER }}:${{ secrets.PASSWORD }}";
      const result = getSecretVariables(template);
      expect(result).toEqual(["USER", "PASSWORD"]);
    });

    it("should ignore non-secret variables", () => {
      const template = "${{ secrets.API_KEY }} and ${{ inputs.name }}";
      const result = getSecretVariables(template);
      expect(result).toEqual(["API_KEY"]);
    });

    it("should return empty array when no secrets found", () => {
      const template = "no secrets here";
      const result = getSecretVariables(template);
      expect(result).toEqual([]);
    });

    it("should handle whitespace in template variables", () => {
      const template = "${{  secrets.API_KEY  }}";
      const result = getSecretVariables(template);
      expect(result).toEqual(["API_KEY"]);
    });
  });

  describe("renderSecretsFromEnv", () => {
    it("should replace secret variables with environment values", () => {
      process.env.API_KEY = "secret-value";
      const template = "Bearer ${{ secrets.API_KEY }}";
      const result = renderSecretsFromEnv(template);
      expect(result).toBe("Bearer secret-value");
    });

    it("should handle multiple secrets", () => {
      process.env.USER = "john";
      process.env.PASSWORD = "secret123";
      const template = "${{ secrets.USER }}:${{ secrets.PASSWORD }}";
      const result = renderSecretsFromEnv(template);
      expect(result).toBe("john:secret123");
    });

    it("should preserve original template when env var not found", () => {
      const template = "Bearer ${{ secrets.MISSING_KEY }}";
      const result = renderSecretsFromEnv(template);
      expect(result).toBe("Bearer ${{ secrets.MISSING_KEY }}");
    });

    it("should handle mixed found and missing secrets", () => {
      process.env.API_KEY = "found";
      const template = "${{ secrets.API_KEY }} and ${{ secrets.MISSING }}";
      const result = renderSecretsFromEnv(template);
      expect(result).toBe("found and ${{ secrets.MISSING }}");
    });

    it("should return original string when no secrets present", () => {
      const template = "no secrets here";
      const result = renderSecretsFromEnv(template);
      expect(result).toBe("no secrets here");
    });
  });

  describe("renderMcpServerHeaders", () => {
    it("should render secrets in headers", () => {
      process.env.API_TOKEN = "token123";
      const headers = {
        Authorization: "Bearer ${{ secrets.API_TOKEN }}",
        "Content-Type": "application/json",
      };
      const result = renderMcpServerHeaders(headers);
      expect(result).toEqual({
        Authorization: "Bearer token123",
        "Content-Type": "application/json",
      });
    });

    it("should return undefined when headers is undefined", () => {
      const result = renderMcpServerHeaders(undefined);
      expect(result).toBeUndefined();
    });

    it("should handle empty headers object", () => {
      const result = renderMcpServerHeaders({});
      expect(result).toEqual({});
    });
  });

  describe("renderMcpServerEnv", () => {
    it("should render secrets in environment variables", () => {
      process.env.DB_PASSWORD = "dbpass123";
      const env = {
        DATABASE_URL: "postgres://user:${{ secrets.DB_PASSWORD }}@host/db",
        NODE_ENV: "production",
      };
      const result = renderMcpServerEnv(env);
      expect(result).toEqual({
        DATABASE_URL: "postgres://user:dbpass123@host/db",
        NODE_ENV: "production",
      });
    });

    it("should return undefined when env is undefined", () => {
      const result = renderMcpServerEnv(undefined);
      expect(result).toBeUndefined();
    });
  });

  describe("renderMcpServerSecrets", () => {
    it("should render secrets in STDIO MCP server", () => {
      process.env.API_KEY = "key123";
      process.env.SECRET_PATH = "/path/to/secret";

      const server: StdioMcpServer = {
        name: "test-stdio",
        command: "node",
        args: ["server.js", "--token", "${{ secrets.API_KEY }}"],
        env: {
          SECRET_FILE: "${{ secrets.SECRET_PATH }}",
          NODE_ENV: "production",
        },
      };

      const result = renderMcpServerSecrets(server);
      expect(result).toEqual({
        name: "test-stdio",
        command: "node",
        args: ["server.js", "--token", "key123"],
        env: {
          SECRET_FILE: "/path/to/secret",
          NODE_ENV: "production",
        },
      });
    });

    it("should render secrets in SSE MCP server", () => {
      process.env.AUTH_TOKEN = "auth123";

      const server: SseMcpServer = {
        name: "test-sse",
        url: "https://api.example.com/mcp",
        requestOptions: {
          headers: {
            Authorization: "Bearer ${{ secrets.AUTH_TOKEN }}",
            "User-Agent": "continue-cli",
          },
        },
      };

      const result = renderMcpServerSecrets(server);
      expect(result).toEqual({
        name: "test-sse",
        url: "https://api.example.com/mcp",
        requestOptions: {
          headers: {
            Authorization: "Bearer auth123",
            "User-Agent": "continue-cli",
          },
        },
      });
    });

    it("should preserve structure for servers without secrets", () => {
      const server: StdioMcpServer = {
        name: "test-no-secrets",
        command: "node",
        args: ["server.js"],
      };

      const result = renderMcpServerSecrets(server);
      expect(result).toEqual(server);
    });
  });

  describe("renderMcpServersSecrets", () => {
    it("should render secrets for multiple servers", () => {
      process.env.TOKEN1 = "token1";
      process.env.TOKEN2 = "token2";

      const servers: MCPServer[] = [
        {
          name: "server1",
          command: "node",
          args: ["--token", "${{ secrets.TOKEN1 }}"],
        },
        {
          name: "server2",
          url: "https://api.example.com",
          requestOptions: {
            headers: {
              Authorization: "Bearer ${{ secrets.TOKEN2 }}",
            },
          },
        },
      ];

      const result = renderMcpServersSecrets(servers);
      expect(result).toHaveLength(2);
      expect(result?.[0]).toEqual({
        name: "server1",
        command: "node",
        args: ["--token", "token1"],
      });
      expect(result?.[1]).toEqual({
        name: "server2",
        url: "https://api.example.com",
        requestOptions: {
          headers: {
            Authorization: "Bearer token2",
          },
        },
      });
    });

    it("should return undefined when servers is undefined", () => {
      const result = renderMcpServersSecrets(undefined);
      expect(result).toBeUndefined();
    });

    it("should handle empty servers array", () => {
      const result = renderMcpServersSecrets([]);
      expect(result).toEqual([]);
    });
  });

  describe("hasUnrenderedSecrets", () => {
    it("should return true when string contains unrendered secrets", () => {
      const value = "Bearer ${{ secrets.API_KEY }}";
      expect(hasUnrenderedSecrets(value)).toBe(true);
    });

    it("should return false when string has no secrets", () => {
      const value = "Bearer token123";
      expect(hasUnrenderedSecrets(value)).toBe(false);
    });

    it("should return false when string has non-secret template vars", () => {
      const value = "Hello ${{ inputs.name }}";
      expect(hasUnrenderedSecrets(value)).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(hasUnrenderedSecrets("")).toBe(false);
    });
  });

  describe("validateMcpServerSecretsRendered", () => {
    it("should return valid when all secrets are rendered", () => {
      const server: StdioMcpServer = {
        name: "test",
        command: "node",
        args: ["server.js", "--token", "rendered-token"],
        env: {
          SECRET: "rendered-secret",
        },
      };

      const result = validateMcpServerSecretsRendered(server);
      expect(result.isValid).toBe(true);
      expect(result.unrenderedSecrets).toEqual([]);
    });

    it("should return invalid when secrets are unrendered", () => {
      const server: StdioMcpServer = {
        name: "test",
        command: "node",
        args: ["server.js", "--token", "${{ secrets.API_KEY }}"],
        env: {
          SECRET: "${{ secrets.SECRET_KEY }}",
          NORMAL: "value",
        },
      };

      const result = validateMcpServerSecretsRendered(server);
      expect(result.isValid).toBe(false);
      expect(result.unrenderedSecrets).toContain("API_KEY");
      expect(result.unrenderedSecrets).toContain("SECRET_KEY");
    });

    it("should handle SSE server validation", () => {
      const server: SseMcpServer = {
        name: "test-sse",
        url: "https://api.example.com/mcp",
        requestOptions: {
          headers: {
            Authorization: "Bearer ${{ secrets.AUTH_TOKEN }}",
          },
        },
      };

      const result = validateMcpServerSecretsRendered(server);
      expect(result.isValid).toBe(false);
      expect(result.unrenderedSecrets).toContain("AUTH_TOKEN");
    });

    it("should handle complex nested structures", () => {
      const server: StdioMcpServer = {
        name: "test",
        command: "${{ secrets.COMMAND }}",
        args: ["${{ secrets.ARG1 }}", "normal-arg"],
        env: {
          SECRET1: "${{ secrets.SECRET1 }}",
          SECRET2: "${{ secrets.SECRET2 }}",
          NORMAL: "normal-value",
        },
      };

      const result = validateMcpServerSecretsRendered(server);
      expect(result.isValid).toBe(false);
      expect(result.unrenderedSecrets).toHaveLength(4);
      expect(result.unrenderedSecrets).toContain("COMMAND");
      expect(result.unrenderedSecrets).toContain("ARG1");
      expect(result.unrenderedSecrets).toContain("SECRET1");
      expect(result.unrenderedSecrets).toContain("SECRET2");
    });

    it("should handle all documented secret locations", () => {
      const server: StdioMcpServer = {
        name: "${{ secrets.SERVER_NAME }}",
        command: "${{ secrets.CUSTOM_COMMAND }}",
        args: [
          "server.js",
          "--token",
          "${{ secrets.API_KEY }}",
          "--config",
          "${{ secrets.CONFIG_PATH }}",
        ],
        env: {
          DATABASE_URL: "${{ secrets.DATABASE_URL }}",
          CUSTOM_SECRET: "${{ secrets.ENV_SECRET }}", // Secret in value
          LOG_LEVEL: "info", // No secret
        },
        cwd: "${{ secrets.WORKING_DIR }}",
        faviconUrl: "${{ secrets.ICON_URL }}",
      };

      const result = validateMcpServerSecretsRendered(server);
      expect(result.isValid).toBe(false);
      expect(result.unrenderedSecrets).toContain("SERVER_NAME");
      expect(result.unrenderedSecrets).toContain("CUSTOM_COMMAND");
      expect(result.unrenderedSecrets).toContain("API_KEY");
      expect(result.unrenderedSecrets).toContain("CONFIG_PATH");
      expect(result.unrenderedSecrets).toContain("DATABASE_URL");
      expect(result.unrenderedSecrets).toContain("ENV_SECRET");
      expect(result.unrenderedSecrets).toContain("WORKING_DIR");
      expect(result.unrenderedSecrets).toContain("ICON_URL");
    });

    it("should handle HTTP server with all documented secret locations", () => {
      const server: SseMcpServer = {
        name: "${{ secrets.SERVER_NAME }}",
        url: "${{ secrets.API_BASE_URL }}/mcp",
        type: "sse",
        faviconUrl: "${{ secrets.ICON_URL }}",
        requestOptions: {
          headers: {
            Authorization: "Bearer ${{ secrets.AUTH_TOKEN }}",
            "X-Custom-Value": "${{ secrets.CUSTOM_HEADER_VALUE }}", // Secret in value
            "X-User-ID": "${{ secrets.USER_ID }}",
            "Content-Type": "application/json", // No secret
          },
        },
      };

      const result = validateMcpServerSecretsRendered(server);
      expect(result.isValid).toBe(false);
      expect(result.unrenderedSecrets).toContain("SERVER_NAME");
      expect(result.unrenderedSecrets).toContain("API_BASE_URL");
      expect(result.unrenderedSecrets).toContain("ICON_URL");
      expect(result.unrenderedSecrets).toContain("AUTH_TOKEN");
      expect(result.unrenderedSecrets).toContain("CUSTOM_HEADER_VALUE");
      expect(result.unrenderedSecrets).toContain("USER_ID");
    });
  });
});
