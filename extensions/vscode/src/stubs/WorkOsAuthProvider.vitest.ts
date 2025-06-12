import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { WorkOsAuthProvider } from "./WorkOsAuthProvider";
import { ExtensionContext, EventEmitter } from "vscode";
import { UriEventHandler } from "./uriHandler";
import { SecretStorage } from "./SecretStorage";

// Mock implementations
vi.mock("vscode", () => {
  return {
    authentication: {
      registerAuthenticationProvider: vi.fn(),
    },
    window: {
      registerUriHandler: vi.fn(),
      withProgress: vi.fn(),
      showErrorMessage: vi.fn(),
    },
    EventEmitter: vi.fn().mockImplementation(() => ({
      event: { dispose: vi.fn() },
      fire: vi.fn(),
    })),
    Disposable: {
      from: vi.fn().mockReturnValue({
        dispose: vi.fn(),
      }),
    },
    ProgressLocation: {
      Notification: 1,
    },
    env: {
      openExternal: vi.fn(),
      uriScheme: "vscode",
    },
  };
});

vi.mock("node-fetch", () => {
  return {
    default: vi.fn(),
  };
});

vi.mock("./SecretStorage", () => {
  return {
    SecretStorage: vi.fn().mockImplementation(() => ({
      store: vi.fn(),
      get: vi.fn(),
    })),
  };
});

vi.mock("crypto", () => {
  return {
    default: {
      createHash: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue(Buffer.from("test-hash")),
      }),
    },
  };
});

vi.mock("core/control-plane/env", () => {
  return {
    getControlPlaneEnvSync: vi.fn().mockReturnValue({
      AUTH_TYPE: "workos",
      APP_URL: "https://continue.dev",
      CONTROL_PLANE_URL: "https://api.continue.dev",
      WORKOS_CLIENT_ID: "test-client-id",
    }),
  };
});

describe("WorkOsAuthProvider", () => {
  let authProvider: WorkOsAuthProvider;
  let mockContext: any;
  let mockUriHandler: any;
  let mockFetch: any;
  let mockSessionChangeEmitter: any;
  let mockSecretStorage: any;
  
  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    
    // Setup mocks
    mockSessionChangeEmitter = { fire: vi.fn(), event: {} };
    mockUriHandler = { event: new EventEmitter() };
    mockContext = { secrets: { store: vi.fn(), get: vi.fn() } };
    
    // Mock fetch
    mockFetch = vi.fn();
    vi.doMock("node-fetch", () => ({
      default: mockFetch,
    }));
    
    // Mock SecretStorage
    mockSecretStorage = {
      store: vi.fn(),
      get: vi.fn(),
    };
    vi.spyOn(SecretStorage.prototype, "store").mockImplementation(mockSecretStorage.store);
    vi.spyOn(SecretStorage.prototype, "get").mockImplementation(mockSecretStorage.get);
    
    // Create instance
    authProvider = new WorkOsAuthProvider(
      mockContext as unknown as ExtensionContext,
      mockUriHandler as unknown as UriEventHandler
    );
    
    // Replace private emitter with our mock
    (authProvider as any)._sessionChangeEmitter = mockSessionChangeEmitter;
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should initialize refresh timer on construction", async () => {
    // Get the private refreshSessions method
    const refreshSessionsSpy = vi.spyOn(authProvider as any, "_refreshSessions");
    
    // Mock session data
    const mockSession = {
      id: "test-id",
      accessToken: "valid-token",
      refreshToken: "refresh-token",
      expiresInMs: 900000, // 15 minutes
      account: {
        label: "Test User",
        id: "test@example.com",
      },
      scopes: [],
    };
    
    // Mock the getSessions method to return our test session
    mockSecretStorage.get.mockResolvedValue(JSON.stringify([mockSession]));
    
    // Call the internal initialize method that would be called in the constructor
    await (authProvider as any).initializeRefreshTimer();
    
    // Check that refreshSessions was called once during initialization
    expect(refreshSessionsSpy).toHaveBeenCalledTimes(1);
    
    // Verify that setInterval was called with the right timing
    expect(global.setInterval).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Number)
    );
  });

  test("should handle transient errors during token refresh", async () => {
    // Mock the session data
    const mockSession = {
      id: "test-id",
      accessToken: "valid-token",
      refreshToken: "refresh-token",
      expiresInMs: 900000, // 15 minutes
      account: {
        label: "Test User",
        id: "test@example.com",
      },
      scopes: [],
      loginNeeded: false,
    };
    
    // Setup the mock to return our session
    mockSecretStorage.get.mockResolvedValue(JSON.stringify([mockSession]));
    
    // Mock the fetch to simulate a network error
    const networkError = new Error("Network error");
    mockFetch.mockRejectedValueOnce(networkError);
    
    // Add a spy to the refreshSession method
    const refreshSessionSpy = vi.spyOn(authProvider as any, "_refreshSession");
    
    // Mock the JWT validation to return false (not expired)
    vi.spyOn(authProvider as any, "jwtIsExpiredOrInvalid").mockReturnValue(false);
    
    // Call refreshSessions
    await authProvider.refreshSessions();
    
    // Verify refresh was attempted
    expect(refreshSessionSpy).toHaveBeenCalledWith(mockSession.refreshToken);
    
    // Check that we didn't remove the session despite the error
    expect(mockSessionChangeEmitter.fire).not.toHaveBeenCalledWith({
      added: [],
      removed: [mockSession],
      changed: [],
    });
    
    // Check that we kept the original session
    expect(mockSecretStorage.store).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify([{
        ...mockSession,
        loginNeeded: true, // Marked as needing login but not removed
      }])
    );
  });

  test("should remove session only if token is expired or invalid", async () => {
    // Mock the session data
    const mockSession = {
      id: "test-id",
      accessToken: "valid-token",
      refreshToken: "refresh-token",
      expiresInMs: 900000, // 15 minutes
      account: {
        label: "Test User",
        id: "test@example.com",
      },
      scopes: [],
      loginNeeded: false,
    };
    
    // Setup the mock to return our session
    mockSecretStorage.get.mockResolvedValue(JSON.stringify([mockSession]));
    
    // Mock the fetch to simulate an auth error
    const authError = new Error("Invalid token");
    mockFetch.mockRejectedValueOnce(authError);
    
    // First test: Token is NOT expired (should keep session, mark loginNeeded)
    vi.spyOn(authProvider as any, "jwtIsExpiredOrInvalid").mockReturnValueOnce(false);
    
    await authProvider.refreshSessions();
    
    // Verify we kept the session but marked it as needing login
    expect(mockSecretStorage.store).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify([{
        ...mockSession,
        loginNeeded: true,
      }])
    );
    
    // Reset mocks
    mockSecretStorage.store.mockReset();
    vi.clearAllMocks();
    
    // Second test: Token IS expired (should remove session)
    mockSecretStorage.get.mockResolvedValue(JSON.stringify([mockSession]));
    vi.spyOn(authProvider as any, "jwtIsExpiredOrInvalid").mockReturnValueOnce(true);
    mockFetch.mockRejectedValueOnce(authError);
    
    await authProvider.refreshSessions();
    
    // Verify we removed the session
    expect(mockSessionChangeEmitter.fire).toHaveBeenCalledWith({
      added: [],
      removed: [mockSession],
      changed: [],
    });
    expect(mockSecretStorage.store).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify([])
    );
  });

  test("should handle multiple refresh attempts with backoff", async () => {
    // Create a mock for setTimeout to verify backoff behavior
    const setTimeoutSpy = vi.spyOn(global, "setTimeout");
    
    // Mock the session data
    const mockSession = {
      id: "test-id",
      accessToken: "valid-token",
      refreshToken: "refresh-token",
      expiresInMs: 900000, // 15 minutes
      account: {
        label: "Test User",
        id: "test@example.com",
      },
      scopes: [],
      loginNeeded: true, // Already marked as needing login
    };
    
    // Setup the mock to return our session
    mockSecretStorage.get.mockResolvedValue(JSON.stringify([mockSession]));
    
    // Mock the fetch to simulate a network error multiple times
    mockFetch.mockRejectedValueOnce(new Error("Network error 1"));
    
    // Mock the refresh attempts counter
    vi.spyOn(authProvider as any, "getRefreshAttempts").mockReturnValueOnce(2);
    
    // Call refreshSessions
    await authProvider.refreshSessions();
    
    // Verify setTimeout was called with an increasing backoff time
    expect(setTimeoutSpy).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Number)
    );
    
    // Get the backoff time that was used
    const backoffTime = setTimeoutSpy.mock.calls[0][1];
    
    // Verify it's an exponential backoff (should be more than the base retry time)
    expect(backoffTime).toBeGreaterThan(5000); // Should be at least 5 seconds for attempt #2
  });
});