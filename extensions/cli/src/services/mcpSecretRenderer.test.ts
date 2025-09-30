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
    it("should render secrets only in allowed fields for STDIO server", () => {
      process.env.API_KEY = "key123";
      process.env.SECRET_PATH = "/path/to/secret";
      process.env.SERVER_NAME = "rendered-name";
      process.env.CUSTOM_CMD = "custom-command";

      const server: StdioMcpServer = {
        name: "${{ secrets.SERVER_NAME }}", // Should NOT be rendered
        command: "${{ secrets.CUSTOM_CMD }}", // Should NOT be rendered
        args: ["server.js", "--token", "${{ secrets.API_KEY }}"], // Should be rendered
        env: {
          SECRET_FILE: "${{ secrets.SECRET_PATH }}", // Should be rendered
          NODE_ENV: "production",
        },
      };

      const result = renderMcpServerSecrets(server);
      expect(result).toEqual({
        name: "${{ secrets.SERVER_NAME }}", // Unchanged
        command: "${{ secrets.CUSTOM_CMD }}", // Unchanged
        args: ["server.js", "--token", "key123"], // Rendered
        env: {
          SECRET_FILE: "/path/to/secret", // Rendered
          NODE_ENV: "production",
        },
      });
    });

    it("should render secrets only in allowed fields for SSE server", () => {
      process.env.AUTH_TOKEN = "auth123";
      process.env.API_URL = "https://secret-api.com";
      process.env.SERVER_NAME = "rendered-name";

      const server: SseMcpServer = {
        name: "${{ secrets.SERVER_NAME }}", // Should NOT be rendered
        url: "${{ secrets.API_URL }}/mcp", // Should be rendered
        requestOptions: {
          headers: {
            Authorization: "Bearer ${{ secrets.AUTH_TOKEN }}", // Should be rendered
            "User-Agent": "continue-cli",
          },
        },
      };

      const result = renderMcpServerSecrets(server);
      expect(result).toEqual({
        name: "${{ secrets.SERVER_NAME }}", // Unchanged
        url: "https://secret-api.com/mcp", // Rendered
        requestOptions: {
          headers: {
            Authorization: "Bearer auth123", // Rendered
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

    it("should not render secrets in restricted fields", () => {
      process.env.SERVER_NAME = "secret-name";
      process.env.CUSTOM_COMMAND = "secret-command";
      process.env.WORKING_DIR = "/secret/path";
      process.env.FAVICON_URL = "https://secret.com/favicon.ico";
      process.env.API_KEY = "secret-key";

      const server: StdioMcpServer = {
        name: "${{ secrets.SERVER_NAME }}",
        command: "${{ secrets.CUSTOM_COMMAND }}",
        cwd: "${{ secrets.WORKING_DIR }}",
        faviconUrl: "${{ secrets.FAVICON_URL }}",
        args: ["--token", "${{ secrets.API_KEY }}"], // This SHOULD be rendered
      };

      const result = renderMcpServerSecrets(server) as StdioMcpServer;

      // Restricted fields should remain unchanged
      expect(result.name).toBe("${{ secrets.SERVER_NAME }}");
      expect(result.command).toBe("${{ secrets.CUSTOM_COMMAND }}");
      expect(result.cwd).toBe("${{ secrets.WORKING_DIR }}");
      expect(result.faviconUrl).toBe("${{ secrets.FAVICON_URL }}");

      // Allowed fields should be rendered
      expect(result.args).toEqual(["--token", "secret-key"]);
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
        command: "${{ secrets.COMMAND }}", // Not validated
        args: ["${{ secrets.ARG1 }}", "normal-arg"], // Validated
        env: {
          SECRET1: "${{ secrets.SECRET1 }}", // Validated
          SECRET2: "${{ secrets.SECRET2 }}", // Validated
          NORMAL: "normal-value",
        },
      };

      const result = validateMcpServerSecretsRendered(server);
      expect(result.isValid).toBe(false);
      expect(result.unrenderedSecrets).toHaveLength(3); // Only args and env are validated
      expect(result.unrenderedSecrets).not.toContain("COMMAND"); // Command is not validated
      expect(result.unrenderedSecrets).toContain("ARG1");
      expect(result.unrenderedSecrets).toContain("SECRET1");
      expect(result.unrenderedSecrets).toContain("SECRET2");
    });

    it("should handle all allowed secret locations for STDIO server", () => {
      const server: StdioMcpServer = {
        name: "${{ secrets.SERVER_NAME }}", // Not rendered
        command: "${{ secrets.CUSTOM_COMMAND }}", // Not rendered
        args: [
          "server.js",
          "--token",
          "${{ secrets.API_KEY }}", // Rendered
          "--config",
          "${{ secrets.CONFIG_PATH }}", // Rendered
        ],
        env: {
          DATABASE_URL: "${{ secrets.DATABASE_URL }}", // Rendered
          CUSTOM_SECRET: "${{ secrets.ENV_SECRET }}", // Rendered
          LOG_LEVEL: "info", // No secret
        },
        cwd: "${{ secrets.WORKING_DIR }}", // Not rendered
        faviconUrl: "${{ secrets.ICON_URL }}", // Not rendered
      };

      const result = validateMcpServerSecretsRendered(server);
      expect(result.isValid).toBe(false);
      // Only secrets in args and env should be detected
      expect(result.unrenderedSecrets).toContain("API_KEY");
      expect(result.unrenderedSecrets).toContain("CONFIG_PATH");
      expect(result.unrenderedSecrets).toContain("DATABASE_URL");
      expect(result.unrenderedSecrets).toContain("ENV_SECRET");
      // These should NOT be detected (not in allowed fields)
      expect(result.unrenderedSecrets).not.toContain("SERVER_NAME");
      expect(result.unrenderedSecrets).not.toContain("CUSTOM_COMMAND");
      expect(result.unrenderedSecrets).not.toContain("WORKING_DIR");
      expect(result.unrenderedSecrets).not.toContain("ICON_URL");
      expect(result.unrenderedSecrets).toHaveLength(4);
    });

    it("should handle HTTP server with all allowed secret locations", () => {
      const server: SseMcpServer = {
        name: "${{ secrets.SERVER_NAME }}", // Not rendered
        url: "${{ secrets.API_BASE_URL }}/mcp", // Rendered
        type: "sse",
        faviconUrl: "${{ secrets.ICON_URL }}", // Not rendered
        requestOptions: {
          headers: {
            Authorization: "Bearer ${{ secrets.AUTH_TOKEN }}", // Rendered
            "X-Custom-Value": "${{ secrets.CUSTOM_HEADER_VALUE }}", // Rendered
            "X-User-ID": "${{ secrets.USER_ID }}", // Rendered
            "Content-Type": "application/json", // No secret
          },
        },
      };

      const result = validateMcpServerSecretsRendered(server);
      expect(result.isValid).toBe(false);
      // Only secrets in url and headers should be detected
      expect(result.unrenderedSecrets).toContain("API_BASE_URL");
      expect(result.unrenderedSecrets).toContain("AUTH_TOKEN");
      expect(result.unrenderedSecrets).toContain("CUSTOM_HEADER_VALUE");
      expect(result.unrenderedSecrets).toContain("USER_ID");
      // These should NOT be detected (not in allowed fields)
      expect(result.unrenderedSecrets).not.toContain("SERVER_NAME");
      expect(result.unrenderedSecrets).not.toContain("ICON_URL");
      expect(result.unrenderedSecrets).toHaveLength(4);
    });
  });
});
