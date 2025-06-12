import fetch from "node-fetch";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "vscode";
import { WorkOsAuthProvider } from "./WorkOsAuthProvider";

// Mock the modules we need
vi.mock("vscode", () => ({
  authentication: {
    registerAuthenticationProvider: vi.fn(),
  },
  window: {
    registerUriHandler: vi.fn(),
  },
  EventEmitter: vi.fn(() => ({
    event: { dispose: vi.fn() },
    fire: vi.fn(),
  })),
  Disposable: {
    from: vi.fn(() => ({ dispose: vi.fn() })),
  },
  env: {
    uriScheme: "vscode",
  },
}));

vi.mock("node-fetch");

vi.mock("core/control-plane/env", () => ({
  getControlPlaneEnvSync: vi.fn(() => ({
    AUTH_TYPE: "workos",
    APP_URL: "https://continue.dev",
    CONTROL_PLANE_URL: "https://api.continue.dev",
    WORKOS_CLIENT_ID: "client_123",
  })),
}));

vi.mock("crypto", () => ({
  createHash: vi.fn(() => ({
    update: vi.fn(() => ({
      digest: vi.fn(() => Buffer.from("test-hash")),
    })),
  })),
}));

// Mock SecretStorage class
vi.mock("./SecretStorage", () => {
  const mockStore = vi.fn();
  const mockGet = vi.fn();
  return {
    SecretStorage: vi.fn(() => ({
      store: mockStore,
      get: mockGet,
    })),
  };
});

// Helper to create valid and expired JWTs
function createJwt({ expired }: { expired: boolean }): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: "user123",
    iat: now,
    exp: expired ? now - 3600 : now + 3600, // Expired 1 hour ago or valid for 1 hour
  };

  const base64Header = Buffer.from(JSON.stringify(header))
    .toString("base64")
    .replace(/=/g, "");
  const base64Payload = Buffer.from(JSON.stringify(payload))
    .toString("base64")
    .replace(/=/g, "");
  const signature = "dummysignature";

  return `${base64Header}.${base64Payload}.${signature}`;
}

describe("WorkOsAuthProvider", () => {
  let provider: WorkOsAuthProvider;
  let mockFetch: any;
  let mockUriHandler: any;
  let mockContext: any;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Setup mocks for fetch
    mockFetch = fetch as any;
    mockFetch.mockClear();

    // Create a mock UriHandler
    mockUriHandler = {
      event: new EventEmitter(),
      handleCallback: vi.fn(),
    };

    // Create a mock ExtensionContext
    mockContext = {
      secrets: {
        store: vi.fn(),
        get: vi.fn(),
      },
      subscriptions: [],
    };

    // Setup timing mocks
    vi.useFakeTimers();

    // Create instance of provider
    provider = new WorkOsAuthProvider(mockContext, mockUriHandler);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it("should refresh tokens on initialization when sessions exist", async () => {
    // Setup existing sessions with a valid token
    const validToken = createJwt({ expired: false });
    const mockSession = {
      id: "test-id",
      accessToken: validToken,
      refreshToken: "refresh-token",
      expiresInMs: 3600000, // 1 hour
      account: { label: "Test User", id: "user@example.com" },
      scopes: [],
      loginNeeded: false,
    };

    // Mock SecretStorage.get to return a session
    vi.mocked(provider["secretStorage"].get).mockResolvedValue(
      JSON.stringify([mockSession]),
    );

    // Setup successful token refresh
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        accessToken: createJwt({ expired: false }),
        refreshToken: "new-refresh-token",
      }),
      text: async () => "",
    });

    // Initialize by getting sessions
    await provider.getSessions();

    // Verify that the token refresh endpoint was called
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/auth/refresh" }),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("refresh-token"),
      }),
    );
  });

  it("should not remove sessions during transient network errors", async () => {
    // Setup a session
    const validToken = createJwt({ expired: false });
    const mockSession = {
      id: "test-id",
      accessToken: validToken,
      refreshToken: "refresh-token",
      expiresInMs: 300000, // 5 minutes
      account: { label: "Test User", id: "user@example.com" },
      scopes: [],
      loginNeeded: false,
    };

    // Mock SecretStorage.get to return a session
    vi.mocked(provider["secretStorage"].get).mockResolvedValue(
      JSON.stringify([mockSession]),
    );

    // First refresh attempt fails with network error
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    // Call refresh sessions
    await provider.refreshSessions();

    // Check that sessions were not cleared after network error
    expect(provider["secretStorage"].store).not.toHaveBeenCalledWith(
      expect.anything(),
      "[]",
    );

    // Second refresh attempt should happen after backoff
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        accessToken: createJwt({ expired: false }),
        refreshToken: "new-refresh-token",
      }),
      text: async () => "",
    });

    // Advance timer to trigger retry
    vi.advanceTimersByTime(1000);

    // Verify second attempt was made
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("should refresh tokens at regular intervals rather than based on expiration", async () => {
    // Setup a session with a token that has a long expiration
    const validToken = createJwt({ expired: false });
    const mockSession = {
      id: "test-id",
      accessToken: validToken,
      refreshToken: "refresh-token",
      expiresInMs: 3600000, // 1 hour
      account: { label: "Test User", id: "user@example.com" },
      scopes: [],
      loginNeeded: false,
    };

    // Mock SecretStorage.get to return a session
    vi.mocked(provider["secretStorage"].get).mockResolvedValue(
      JSON.stringify([mockSession]),
    );

    // Setup successful token refresh responses
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        accessToken: createJwt({ expired: false }),
        refreshToken: "new-refresh-token",
      }),
      text: async () => "",
    });

    // Spy on setInterval
    const setIntervalSpy = vi.spyOn(global, "setInterval");

    // Initialize by getting sessions
    await provider.getSessions();

    // First refresh should happen immediately on initialization
    expect(mockFetch).toHaveBeenCalledTimes(1);
    mockFetch.mockClear();

    // Verify that setInterval was called to set up regular refreshes
    expect(setIntervalSpy).toHaveBeenCalled();

    // Get the interval time
    const intervalTime = setIntervalSpy.mock.calls[0][1];

    // Should be a reasonable interval (less than the expiration time)
    expect(intervalTime).toBeLessThan(mockSession.expiresInMs);

    // Advance time to trigger the interval
    vi.advanceTimersByTime(intervalTime as number);

    // Verify that refresh was called again at the interval
    expect(mockFetch).toHaveBeenCalledTimes(1);
    mockFetch.mockClear();

    // Advance time again to trigger another interval
    vi.advanceTimersByTime(intervalTime as number);

    // Verify that refresh was called again
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Check that we're making refresh calls to the right endpoint
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/auth/refresh" }),
      expect.any(Object),
    );
  });

  it("should remove session if token refresh fails with authentication error", async () => {
    // Setup a session
    const validToken = createJwt({ expired: false });
    const mockSession = {
      id: "test-id",
      accessToken: validToken,
      refreshToken: "invalid-refresh-token",
      expiresInMs: 300000,
      account: { label: "Test User", id: "user@example.com" },
      scopes: [],
      loginNeeded: false,
    };

    // Mock SecretStorage.get to return a session
    vi.mocked(provider["secretStorage"].get).mockResolvedValue(
      JSON.stringify([mockSession]),
    );

    // Refresh fails with 401 unauthorized
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Invalid refresh token",
    });

    // Call refresh sessions
    await provider.refreshSessions();

    // Verify sessions were removed due to auth error
    expect(provider["secretStorage"].store).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringMatching(/\[\]/),
    );
  });

  it("should remove session if access token is expired and refresh fails", async () => {
    // Setup a session with an expired token
    const expiredToken = createJwt({ expired: true });
    const mockSession = {
      id: "test-id",
      accessToken: expiredToken,
      refreshToken: "refresh-token",
      expiresInMs: 3600000, // This doesn't matter since the token is already expired
      account: { label: "Test User", id: "user@example.com" },
      scopes: [],
      loginNeeded: false,
    };

    // Mock SecretStorage.get to return a session
    vi.mocked(provider["secretStorage"].get).mockResolvedValue(
      JSON.stringify([mockSession]),
    );

    // Refresh fails with server error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Server error",
    });

    // Call refresh sessions
    await provider.refreshSessions();

    // Verify sessions were removed because token was expired
    expect(provider["secretStorage"].store).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringMatching(/\[\]/),
    );
  });

  it("should implement exponential backoff for failed refresh attempts", async () => {
    // Setup a session
    const validToken = createJwt({ expired: false });
    const mockSession = {
      id: "test-id",
      accessToken: validToken,
      refreshToken: "refresh-token",
      expiresInMs: 300000,
      account: { label: "Test User", id: "user@example.com" },
      scopes: [],
      loginNeeded: false,
    };

    // Mock SecretStorage.get to return a session
    vi.mocked(provider["secretStorage"].get).mockResolvedValue(
      JSON.stringify([mockSession]),
    );

    // Setup repeated network errors
    mockFetch.mockRejectedValueOnce(new Error("Network error 1"));
    mockFetch.mockRejectedValueOnce(new Error("Network error 2"));
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        accessToken: createJwt({ expired: false }),
        refreshToken: "new-refresh-token",
      }),
      text: async () => "",
    });

    // Track setTimeout calls
    const setTimeoutSpy = vi.spyOn(global, "setTimeout");

    // Call refresh sessions
    await provider.refreshSessions();

    // Trigger first retry
    vi.advanceTimersByTime(1000); // Initial backoff

    // Trigger second retry
    vi.advanceTimersByTime(2000); // Double the backoff

    // Verify setTimeout was called with increasing delays
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);

    // Get the backoff periods
    const firstDelay = setTimeoutSpy.mock.calls[0][1];
    const secondDelay = setTimeoutSpy.mock.calls[1][1];

    // Check that backoff increased
    expect(secondDelay).toBeGreaterThan(firstDelay);

    // Verify all three attempts were made
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
