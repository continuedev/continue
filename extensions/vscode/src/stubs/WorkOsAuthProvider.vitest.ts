import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import * as vscode from "vscode";
import {
  WorkOsAuthProvider,
  getControlPlaneSessionInfo,
} from "./WorkOsAuthProvider";
import { SecretStorage } from "./SecretStorage";
import { Logger } from "core/util/Logger";

// Mock VS Code
vi.mock("vscode", () => ({
  authentication: {
    getSession: vi.fn(),
    registerAuthenticationProvider: vi.fn(() => ({ dispose: vi.fn() })),
  },
  window: {
    showErrorMessage: vi.fn(),
    registerUriHandler: vi.fn(() => ({ dispose: vi.fn() })),
    withProgress: vi.fn(),
  },
  env: {
    uriScheme: "vscode",
    openExternal: vi.fn(),
  },
  Disposable: {
    from: vi.fn(() => ({ dispose: vi.fn() })),
  },
  EventEmitter: vi.fn(() => ({
    event: vi.fn(),
    fire: vi.fn(),
  })),
  ProgressLocation: {
    Notification: 15,
  },
  Uri: {
    parse: vi.fn((str: string) => ({ toString: () => str })),
    joinPath: vi.fn(),
  },
}));

// Mock Logger
vi.mock("core/util/Logger", () => ({
  Logger: {
    error: vi.fn(),
  },
}));

// Mock SecretStorage
vi.mock("./SecretStorage");

// Mock UriEventHandler
vi.mock("./uriHandler", () => ({
  UriEventHandler: vi.fn(() => ({
    event: vi.fn(),
  })),
}));

// Mock node-fetch
vi.mock("node-fetch", () => ({
  default: vi.fn(),
}));

// Mock uuid
vi.mock("uuid", () => ({
  v4: vi.fn(() => "test-uuid"),
}));

describe("WorkOsAuthProvider - Corrupted Cache Handling", () => {
  let mockContext: any;
  let mockUriHandler: any;
  let mockSecretStorage: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      globalStorageUri: { fsPath: "/test/path" },
      secrets: {
        get: vi.fn(),
        store: vi.fn(),
      },
    };

    mockUriHandler = {
      event: vi.fn(),
    };

    mockSecretStorage = {
      get: vi.fn(),
      store: vi.fn(),
      delete: vi.fn(),
    };

    // Mock SecretStorage constructor
    (SecretStorage as any).mockImplementation(() => mockSecretStorage);
  });

  describe("getSessions - Corrupted Session Data", () => {
    it("should clear corrupted JSON and return empty array", async () => {
      const provider = new WorkOsAuthProvider(mockContext, mockUriHandler);

      // Simulate corrupted JSON
      mockSecretStorage.get.mockResolvedValue("{ corrupted json");

      const sessions = await provider.getSessions();

      expect(sessions).toEqual([]);
      expect(mockSecretStorage.delete).toHaveBeenCalled();
      expect(Logger.error).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          context: "workOS_sessions_json_parse",
        }),
      );
    });

    it("should filter out invalid sessions with missing required fields", async () => {
      const provider = new WorkOsAuthProvider(mockContext, mockUriHandler);

      const invalidSessions = JSON.stringify([
        {
          id: "valid-1",
          accessToken: "token1",
          refreshToken: "refresh1",
          account: { id: "user1", label: "User 1" },
          scopes: [],
          expiresInMs: 900000,
          loginNeeded: false,
        },
        {
          id: "invalid-1",
          // Missing accessToken
          refreshToken: "refresh2",
          account: { id: "user2", label: "User 2" },
          scopes: [],
          expiresInMs: 900000,
          loginNeeded: false,
        },
        {
          id: "invalid-2",
          accessToken: "token3",
          // Missing refreshToken
          account: { id: "user3", label: "User 3" },
          scopes: [],
          expiresInMs: 900000,
          loginNeeded: false,
        },
      ]);

      mockSecretStorage.get.mockResolvedValue(invalidSessions);

      const sessions = await provider.getSessions();

      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe("valid-1");
      expect(mockSecretStorage.store).toHaveBeenCalled();
      expect(Logger.error).toHaveBeenCalledTimes(2);
    });

    it("should return empty array if no sessions are stored", async () => {
      const provider = new WorkOsAuthProvider(mockContext, mockUriHandler);

      mockSecretStorage.get.mockResolvedValue(undefined);

      const sessions = await provider.getSessions();

      expect(sessions).toEqual([]);
      expect(mockSecretStorage.delete).not.toHaveBeenCalled();
    });
  });

  describe("getControlPlaneSessionInfo - Invalid Session Handling", () => {
    beforeEach(() => {
      // Reset the static hasAttemptedRefresh promise
      WorkOsAuthProvider.hasAttemptedRefresh = Promise.resolve();
    });

    it("should return undefined and show error when session has no accessToken", async () => {
      const invalidSession = {
        id: "test-id",
        accessToken: "", // Invalid - empty
        account: { id: "user1", label: "User 1" },
        scopes: [],
      };

      (vscode.authentication.getSession as Mock).mockResolvedValue(
        invalidSession,
      );

      const result = await getControlPlaneSessionInfo(false, false);

      expect(result).toBeUndefined();
      expect(Logger.error).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          context: "workOS_getSession_validation",
          hasAccessToken: false,
        }),
      );
    });

    it("should return undefined when session has no account", async () => {
      const invalidSession = {
        id: "test-id",
        accessToken: "valid-token",
        account: null, // Invalid - null account
        scopes: [],
      };

      (vscode.authentication.getSession as Mock).mockResolvedValue(
        invalidSession,
      );

      const result = await getControlPlaneSessionInfo(false, false);

      expect(result).toBeUndefined();
      expect(Logger.error).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          context: "workOS_getSession_validation",
          hasAccount: false,
        }),
      );
    });

    it("should attempt retry with forceNewSession when validation fails", async () => {
      const invalidSession = {
        id: "test-id",
        accessToken: "",
        account: { id: "user1", label: "User 1" },
        scopes: [],
      };

      const validSession = {
        id: "test-id-new",
        accessToken: "new-valid-token",
        account: { id: "user1", label: "User 1" },
        scopes: [],
      };

      // First call returns invalid, subsequent calls return valid for retry
      (vscode.authentication.getSession as Mock)
        .mockResolvedValueOnce(invalidSession)
        .mockResolvedValueOnce(invalidSession) // silent check
        .mockResolvedValueOnce(validSession); // retry with forceNewSession

      const result = await getControlPlaneSessionInfo(false, false);

      // Should have called getSession multiple times (initial + retry)
      expect(vscode.authentication.getSession).toHaveBeenCalledTimes(3);
      expect(vscode.authentication.getSession).toHaveBeenLastCalledWith(
        expect.any(String),
        [],
        { forceNewSession: true, createIfNone: true },
      );
    });

    it("should show error message on authentication failure when not silent", async () => {
      const error = new Error("Authentication service unavailable");
      (vscode.authentication.getSession as Mock).mockRejectedValue(error);

      const result = await getControlPlaneSessionInfo(false, false);

      expect(result).toBeUndefined();
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining("Authentication failed"),
      );
      expect(Logger.error).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          context: "workOS_getControlPlaneSessionInfo",
          silent: false,
        }),
      );
    });

    it("should not show error message on authentication failure when silent", async () => {
      const error = new Error("Authentication service unavailable");
      (vscode.authentication.getSession as Mock).mockRejectedValue(error);

      const result = await getControlPlaneSessionInfo(true, false);

      expect(result).toBeUndefined();
      expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
      expect(Logger.error).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          context: "workOS_getControlPlaneSessionInfo",
          silent: true,
        }),
      );
    });

    it("should return valid session info when session is valid", async () => {
      const validSession = {
        id: "test-id",
        accessToken: "valid-token",
        account: { id: "user@example.com", label: "Test User" },
        scopes: [],
      };

      (vscode.authentication.getSession as Mock).mockResolvedValue(
        validSession,
      );

      const result = await getControlPlaneSessionInfo(false, false);

      expect(result).toEqual({
        AUTH_TYPE: expect.any(String),
        accessToken: "valid-token",
        account: {
          id: "user@example.com",
          label: "Test User",
        },
      });
      expect(Logger.error).not.toHaveBeenCalled();
    });
  });

  describe("Session Refresh - Token Corruption", () => {
    it("should handle JWT decoding failures gracefully", async () => {
      const provider = new WorkOsAuthProvider(mockContext, mockUriHandler);

      // Access private method for testing (TypeScript will complain but it works)
      const jwtIsExpiredOrInvalid = (
        provider as any
      ).jwtIsExpiredOrInvalid.bind(provider);

      const corruptedJwt = "not.a.valid.jwt";
      const result = jwtIsExpiredOrInvalid(corruptedJwt);

      expect(result).toBe(true);
      expect(Logger.error).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          context: "workOS_auth_jwt_decode",
        }),
      );
    });

    it("should clear and fire event when refresh fails for all sessions", async () => {
      const provider = new WorkOsAuthProvider(mockContext, mockUriHandler);

      const expiredSessions = JSON.stringify([
        {
          id: "expired-1",
          accessToken: "expired-token",
          refreshToken: "invalid-refresh-token",
          account: { id: "user1", label: "User 1" },
          scopes: [],
          expiresInMs: 900000,
          loginNeeded: false,
        },
      ]);

      mockSecretStorage.get.mockResolvedValue(expiredSessions);

      // Mock fetch to fail refresh
      const fetch = (await import("node-fetch")).default as Mock;
      fetch.mockResolvedValue({
        ok: false,
        text: async () => "Invalid refresh token",
      });

      // Manually trigger refresh
      await provider.refreshSessions();

      // Should have attempted to refresh
      expect(fetch).toHaveBeenCalled();
      expect(Logger.error).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          context: "workOS_individual_session_refresh",
        }),
      );
    });
  });
});
