import fs from "node:fs";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GlobalContext } from "../../util/GlobalContext";
import { getGlobalContextFilePath } from "../../util/paths";
import { getOauthToken, performAuth, removeMCPAuth } from "./MCPOauth";

// Mock the MCP SDK auth module
vi.mock("@modelcontextprotocol/sdk/client/auth.js", () => ({
  auth: vi.fn(),
}));

// Mock the MCPManagerSingleton to avoid circular imports
vi.mock("./MCPManagerSingleton", () => ({
  MCPManagerSingleton: {
    getInstance: vi.fn(() => ({
      refreshConnection: vi.fn(),
    })),
  },
}));

describe("MCPOauth", () => {
  let globalContextFilePath: string;
  let mockIde: any;
  let mockMcpServer: any;

  beforeEach(() => {
    // file is present in the core/test directory
    globalContextFilePath = getGlobalContextFilePath();
    if (fs.existsSync(globalContextFilePath)) {
      fs.unlinkSync(globalContextFilePath);
    }

    mockIde = {
      openUrl: vi.fn(),
      showToast: vi.fn(),
      getExternalUri: vi.fn((uri) => Promise.resolve(uri)),
    };

    mockMcpServer = {
      id: "test-server",
      transport: {
        type: "sse",
        url: "https://test-server.com",
      },
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    if (fs.existsSync(globalContextFilePath)) {
      fs.unlinkSync(globalContextFilePath);
    }
  });

  describe("getOauthToken", () => {
    test("should return undefined when no tokens are stored", async () => {
      const result = await getOauthToken("https://test-server.com", mockIde);
      expect(result).toBeUndefined();
    });

    test("should return access token when tokens are stored", async () => {
      const globalContext = new GlobalContext();
      globalContext.update("mcpOauthStorage", {
        "https://test-server.com": {
          tokens: {
            access_token: "test-access-token",
            token_type: "Bearer",
          },
        },
      });

      const result = await getOauthToken("https://test-server.com", mockIde);
      expect(result).toBe("test-access-token");
    });

    test("should handle different server URLs independently", async () => {
      const globalContext = new GlobalContext();
      globalContext.update("mcpOauthStorage", {
        "https://server1.com": {
          tokens: {
            access_token: "token1",
            token_type: "Bearer",
          },
        },
        "https://server2.com": {
          tokens: {
            access_token: "token2",
            token_type: "Bearer",
          },
        },
      });

      const result1 = await getOauthToken("https://server1.com", mockIde);
      const result2 = await getOauthToken("https://server2.com", mockIde);
      const result3 = await getOauthToken("https://server3.com", mockIde);

      expect(result1).toBe("token1");
      expect(result2).toBe("token2");
      expect(result3).toBeUndefined();
    });
  });

  describe("performAuth", () => {
    test("should call auth with correct parameters and return auth result", async () => {
      const { auth } = await import("@modelcontextprotocol/sdk/client/auth.js");
      const mockAuth = vi.mocked(auth);
      mockAuth.mockResolvedValue("AUTHORIZED");

      const result = await performAuth(mockMcpServer, mockIde);

      expect(mockAuth).toHaveBeenCalledWith(
        expect.any(Object), // MCPConnectionOauthProvider instance
        {
          serverUrl: "https://test-server.com",
        },
      );
      expect(result).toBe("AUTHORIZED");
    });
  });

  describe("removeMCPAuth", () => {
    test("should clear oauth storage for the server", () => {
      const globalContext = new GlobalContext();
      globalContext.update("mcpOauthStorage", {
        "https://test-server.com": {
          tokens: {
            access_token: "test-access-token",
            token_type: "Bearer",
          },
          clientInformation: {
            client_id: "test-client-id",
            redirect_uris: ["http://localhost:3000"],
          },
          codeVerifier: "test-code-verifier",
        },
        "https://other-server.com": {
          tokens: {
            access_token: "other-access-token",
            token_type: "Bearer",
          },
        },
      });

      removeMCPAuth(mockMcpServer, mockIde);

      const updatedStorage = globalContext.get("mcpOauthStorage");
      expect(updatedStorage).toEqual({
        "https://other-server.com": {
          tokens: {
            access_token: "other-access-token",
            token_type: "Bearer",
          },
        },
      });
    });

    test("should handle non-existent server gracefully", () => {
      const globalContext = new GlobalContext();
      globalContext.update("mcpOauthStorage", {
        "https://other-server.com": {
          tokens: {
            access_token: "other-access-token",
            token_type: "Bearer",
          },
        },
      });

      removeMCPAuth(mockMcpServer, mockIde);

      const updatedStorage = globalContext.get("mcpOauthStorage");
      expect(updatedStorage).toEqual({
        "https://other-server.com": {
          tokens: {
            access_token: "other-access-token",
            token_type: "Bearer",
          },
        },
      });
    });
  });

  describe("redirect URL handling", () => {
    test("should use getExternalUri when available for VS Code", async () => {
      const vscodeIde = {
        ...mockIde,
        getExternalUri: vi.fn((uri) =>
          Promise.resolve("https://vscode.dev/redirect"),
        ),
      };

      const { auth } = await import("@modelcontextprotocol/sdk/client/auth.js");
      const mockAuth = vi.mocked(auth);
      mockAuth.mockResolvedValue("AUTHORIZED");

      await performAuth(mockMcpServer, vscodeIde);

      expect(vscodeIde.getExternalUri).toHaveBeenCalledWith(
        "http://localhost:3000",
      );
    });

    test("should fallback to localhost when getExternalUri is not available", async () => {
      const ideWithoutExternalUri = {
        openUrl: vi.fn(() => Promise.resolve()),
        showToast: vi.fn(() => Promise.resolve()),
      };

      const { auth } = await import("@modelcontextprotocol/sdk/client/auth.js");
      const mockAuth = vi.mocked(auth);
      mockAuth.mockResolvedValue("AUTHORIZED");

      await performAuth(mockMcpServer, ideWithoutExternalUri as any);

      // Should still work without getExternalUri
      expect(mockAuth).toHaveBeenCalled();
    });

    test("should handle getExternalUri errors gracefully", async () => {
      const errorIde = {
        ...mockIde,
        getExternalUri: vi.fn(() => Promise.reject(new Error("Network error"))),
      };

      const { auth } = await import("@modelcontextprotocol/sdk/client/auth.js");
      const mockAuth = vi.mocked(auth);
      mockAuth.mockResolvedValue("AUTHORIZED");

      // Should not throw, should fallback to localhost
      await performAuth(mockMcpServer, errorIde);

      expect(mockAuth).toHaveBeenCalled();
    });
  });

  describe("concurrent authentication", () => {
    test("should handle multiple concurrent auth flows", async () => {
      const server1 = {
        id: "server-1",
        transport: { type: "sse" as const, url: "https://server1.com" },
        status: "connected" as const,
        errors: [],
        infos: [],
        isProtectedResource: false,
        prompts: [],
        tools: [],
        resources: [],
        resourceTemplates: [],
        name: "server-1",
      };
      const server2 = {
        id: "server-2",
        transport: { type: "sse" as const, url: "https://server2.com" },
        status: "connected" as const,
        errors: [],
        infos: [],
        isProtectedResource: false,
        prompts: [],
        tools: [],
        resources: [],
        resourceTemplates: [],
        name: "server-2",
      };

      const { auth } = await import("@modelcontextprotocol/sdk/client/auth.js");
      const mockAuth = vi.mocked(auth);
      mockAuth.mockResolvedValue("AUTHORIZED");

      // Start two auth flows concurrently
      const [result1, result2] = await Promise.all([
        performAuth(server1, mockIde),
        performAuth(server2, mockIde),
      ]);

      expect(result1).toBe("AUTHORIZED");
      expect(result2).toBe("AUTHORIZED");
      expect(mockAuth).toHaveBeenCalledTimes(2);
    });
  });

  describe("error handling", () => {
    test("should clean up context on auth failure", async () => {
      const { auth } = await import("@modelcontextprotocol/sdk/client/auth.js");
      const mockAuth = vi.mocked(auth);

      // First successful call to set up the context
      mockAuth.mockResolvedValueOnce("AUTHORIZED");
      await performAuth(mockMcpServer, mockIde);

      // Reset mock for the failure test
      mockAuth.mockRejectedValueOnce(new Error("Auth failed"));

      // Second call that should fail and clean up
      await expect(performAuth(mockMcpServer, mockIde)).rejects.toThrow(
        "Auth failed",
      );

      // Verify auth was called twice
      expect(mockAuth).toHaveBeenCalledTimes(2);

      // The context cleanup happens internally in performAuth's catch block
      // We can verify it indirectly by checking that a subsequent auth call works
      mockAuth.mockResolvedValueOnce("AUTHORIZED");
      const result = await performAuth(mockMcpServer, mockIde);
      expect(result).toBe("AUTHORIZED");
    });

    test("should handle missing server URL", async () => {
      const invalidServer = {
        id: "invalid",
        transport: { type: "sse" as const, url: "" },
        status: "connected" as const,
        errors: [],
        infos: [],
        isProtectedResource: false,
        prompts: [],
        tools: [],
        resources: [],
        resourceTemplates: [],
        name: "invalid",
      };

      const { auth } = await import("@modelcontextprotocol/sdk/client/auth.js");
      const mockAuth = vi.mocked(auth);
      mockAuth.mockResolvedValue("AUTHORIZED");

      await performAuth(invalidServer, mockIde);

      // Should still attempt auth with empty URL
      expect(mockAuth).toHaveBeenCalled();
    });
  });
});
