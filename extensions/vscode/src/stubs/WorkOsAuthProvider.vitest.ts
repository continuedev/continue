import fetch from "node-fetch";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EventEmitter } from "vscode";

// Don't import WorkOsAuthProvider directly here

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

// Properly mock node-fetch
vi.mock("node-fetch", () => {
  return {
    __esModule: true,
    default: vi.fn(),
  };
});

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

// Create a simple SecretStorage mock that we can control
const mockSecretStorageGet = vi.fn();
const mockSecretStorageStore = vi.fn();

// Mock SecretStorage class
vi.mock("./SecretStorage", () => {
  return {
    SecretStorage: vi.fn().mockImplementation(() => ({
      store: mockSecretStorageStore,
      get: mockSecretStorageGet,
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

beforeEach(() => {
  // Set up fake timers before each test
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers(); // Restore real timers after each test
});

it("should refresh tokens on initialization when sessions exist", async () => {
  // Mock setInterval to prevent the refresh interval
  const originalSetInterval = global.setInterval;
  global.setInterval = vi.fn().mockReturnValue(123 as any);

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

  // Setup fetch mock
  const fetchMock = fetch as any;
  fetchMock.mockClear();

  // Setup successful token refresh
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      accessToken: createJwt({ expired: false }),
      refreshToken: "new-refresh-token",
    }),
    text: async () => "",
  });

  // Create a mock UriHandler
  const mockUriHandler = {
    event: new EventEmitter(),
    handleCallback: vi.fn(),
  };

  // Create a mock ExtensionContext
  const mockContext = {
    secrets: {
      store: vi.fn(),
      get: vi.fn(),
    },
    subscriptions: [],
  };

  // Set up our SecretStorage mock to return the session
  mockSecretStorageGet.mockResolvedValue(JSON.stringify([mockSession]));

  // Import WorkOsAuthProvider after setting up all mocks
  const { WorkOsAuthProvider } = await import("./WorkOsAuthProvider");

  // Create provider instance - this will automatically call refreshSessions
  const provider = new WorkOsAuthProvider(mockContext, mockUriHandler);

  // Wait for all promises to resolve, including any nested promise chains
  await new Promise(process.nextTick);

  // Verify that the token refresh endpoint was called
  expect(fetchMock).toHaveBeenCalledWith(
    expect.any(URL),
    expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("refresh-token"),
    }),
  );

  // Restore setInterval
  global.setInterval = originalSetInterval;

  // Clean up
  if (provider._refreshInterval) {
    clearInterval(provider._refreshInterval);
    provider._refreshInterval = null;
  }
});

it("should not remove sessions during transient network errors", async () => {
  // Setup existing sessions with a valid token
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

  // Setup fetch mock
  const fetchMock = fetch as any;
  fetchMock.mockClear();

  // First refresh attempt fails with network error
  fetchMock.mockRejectedValueOnce(new Error("Network error"));

  // Second refresh attempt should succeed
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      accessToken: createJwt({ expired: false }),
      refreshToken: "new-refresh-token",
    }),
    text: async () => "",
  });

  // Create a mock UriHandler
  const mockUriHandler = {
    event: new EventEmitter(),
    handleCallback: vi.fn(),
  };

  // Create a mock ExtensionContext
  const mockContext = {
    secrets: {
      store: vi.fn(),
      get: vi.fn(),
    },
    subscriptions: [],
  };

  // Set up our SecretStorage mock to return the session
  mockSecretStorageGet.mockResolvedValue(JSON.stringify([mockSession]));

  // Import WorkOsAuthProvider after setting up all mocks
  const { WorkOsAuthProvider } = await import("./WorkOsAuthProvider");

  // Allow setInterval to work normally with fake timers
  // We're not mocking it anymore, instead we'll control when it fires

  // Create provider instance - this will automatically call refreshSessions with the network error
  const provider = new WorkOsAuthProvider(mockContext, mockUriHandler);

  // Run microtasks to process promises from the initial refresh call
  await Promise.resolve();

  // Check that sessions were not cleared after network error
  expect(mockSecretStorageStore).not.toHaveBeenCalledWith(
    expect.anything(),
    expect.stringMatching(/\[\]/),
  );

  // Reset the fetch mock call count to verify the next call
  fetchMock.mockClear();

  // Advance timers to the next refresh interval to simulate the timer firing
  vi.advanceTimersByTime(WorkOsAuthProvider.REFRESH_INTERVAL_MS);

  // Run microtasks to process promises from the interval-triggered refresh
  await Promise.resolve();

  // Verify the second attempt was made via the interval
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(
    expect.any(URL),
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "Content-Type": "application/json",
      }),
      body: expect.stringContaining("refresh-token"),
    }),
  );

  // Clean up
  if (provider._refreshInterval) {
    clearInterval(provider._refreshInterval);
    provider._refreshInterval = null;
  }
});

it("should refresh tokens at regular intervals rather than based on expiration", async () => {
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

  // Setup fetch mock
  const fetchMock = fetch as any;
  fetchMock.mockClear();

  // Setup successful token refresh responses for multiple calls
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      accessToken: createJwt({ expired: false }),
      refreshToken: "new-refresh-token",
    }),
    text: async () => "",
  });

  // Create a mock UriHandler
  const mockUriHandler = {
    event: new EventEmitter(),
    handleCallback: vi.fn(),
  };

  // Create a mock ExtensionContext
  const mockContext = {
    secrets: {
      store: vi.fn(),
      get: vi.fn(),
    },
    subscriptions: [],
  };

  // Set up our SecretStorage mock to return the session
  mockSecretStorageGet.mockResolvedValue(JSON.stringify([mockSession]));

  // Import WorkOsAuthProvider after setting up all mocks
  const { WorkOsAuthProvider } = await import("./WorkOsAuthProvider");

  // Capture the original setInterval to restore it later
  const originalSetInterval = global.setInterval;

  // Create our own implementation of setInterval that we can control better
  let intervalCallback: Function;
  global.setInterval = vi.fn((callback, ms) => {
    intervalCallback = callback;
    return 123 as any; // Return a dummy interval ID
  });

  // Create provider instance - this will automatically call refreshSessions
  const provider = new WorkOsAuthProvider(mockContext, mockUriHandler);

  // Wait for all promises to resolve, including any nested promise chains
  await new Promise(process.nextTick);

  // First refresh should happen immediately on initialization
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fetchMock.mockClear();

  // Verify that setInterval was called to set up regular refreshes
  expect(global.setInterval).toHaveBeenCalled();

  // Get the interval time from the call to setInterval
  const intervalTime = (global.setInterval as any).mock.calls[0][1];

  // Should be a reasonable interval (less than the expiration time)
  expect(intervalTime).toBeLessThan(mockSession.expiresInMs);

  // Now manually trigger the interval callback - First interval
  intervalCallback();

  // Wait for all promises to resolve
  await new Promise(process.nextTick);

  // Verify that refresh was called again when the interval callback fired
  expect(fetchMock).toHaveBeenCalledTimes(1);

  // Check that we're making refresh calls to the right endpoint with the right data
  expect(fetchMock).toHaveBeenCalledWith(
    expect.objectContaining({ pathname: "/auth/refresh" }),
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "Content-Type": "application/json",
      }),
      body: expect.stringContaining("refresh-token"),
    }),
  );

  // Clear mock calls for the second interval test
  fetchMock.mockClear();

  // Trigger the callback again - Second interval
  intervalCallback();

  // Wait for all promises to resolve
  await new Promise(process.nextTick);

  // Verify the refresh was called a second time
  expect(fetchMock).toHaveBeenCalledTimes(1);

  // Verify the second call has the same correct parameters
  expect(fetchMock).toHaveBeenCalledWith(
    expect.objectContaining({ pathname: "/auth/refresh" }),
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "Content-Type": "application/json",
      }),
      body: expect.stringContaining("refresh-token"),
    }),
  );

  // Restore the original setInterval
  global.setInterval = originalSetInterval;

  // Clean up
  if (provider._refreshInterval) {
    clearInterval(provider._refreshInterval);
    provider._refreshInterval = null;
  }
});

it("should remove session if token refresh fails with authentication error", async () => {
  // Setup existing sessions with a valid token
  const validToken = createJwt({ expired: false });
  const mockSession = {
    id: "test-id",
    accessToken: validToken,
    refreshToken: "invalid-refresh-token",
    expiresInMs: 300000, // 5 minutes
    account: { label: "Test User", id: "user@example.com" },
    scopes: [],
    loginNeeded: false,
  };

  // Setup fetch mock
  const fetchMock = fetch as any;
  fetchMock.mockClear();

  // Setup refresh to fail with 401 unauthorized
  fetchMock.mockResolvedValueOnce({
    ok: false,
    status: 401,
    text: async () => "Invalid refresh token",
  });

  // Create a mock UriHandler
  const mockUriHandler = {
    event: new EventEmitter(),
    handleCallback: vi.fn(),
  };

  // Create a mock ExtensionContext
  const mockContext = {
    secrets: {
      store: vi.fn(),
      get: vi.fn(),
    },
    subscriptions: [],
  };

  // Mock setInterval to prevent continuous refreshes
  const originalSetInterval = global.setInterval;
  global.setInterval = vi.fn().mockReturnValue(123 as any);

  // Set up our SecretStorage mock to return the session
  mockSecretStorageGet.mockResolvedValue(JSON.stringify([mockSession]));
  mockSecretStorageStore.mockClear();

  // Import WorkOsAuthProvider after setting up all mocks
  const { WorkOsAuthProvider } = await import("./WorkOsAuthProvider");

  // Create provider instance - this will automatically call refreshSessions
  const provider = new WorkOsAuthProvider(mockContext, mockUriHandler);

  // Wait for all promises to resolve, including any nested promise chains
  await new Promise(process.nextTick);

  // Verify that the token refresh endpoint was called
  expect(fetchMock).toHaveBeenCalledWith(
    expect.any(URL),
    expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("invalid-refresh-token"),
    }),
  );

  // Verify sessions were removed due to auth error
  expect(mockSecretStorageStore).toHaveBeenCalledWith(
    "workos.sessions", // Use the hard-coded key that matches our mock
    expect.stringMatching(/\[\]/),
  );

  // Restore setInterval
  global.setInterval = originalSetInterval;

  // Clean up
  if (provider._refreshInterval) {
    clearInterval(provider._refreshInterval);
    provider._refreshInterval = null;
  }
});

it("should handle refresh failures differently for expired vs valid tokens", async () => {
  // First scenario: Valid token with refresh failure
  // Setup existing sessions with a VALID token
  const validToken = createJwt({ expired: false });
  const validSession = {
    id: "valid-id",
    accessToken: validToken,
    refreshToken: "valid-refresh-token",
    expiresInMs: 3600000,
    account: { label: "Valid User", id: "valid@example.com" },
    scopes: [],
    loginNeeded: false,
  };

  // Setup fetch mock for valid token - it will fail with network error
  const fetchMock = fetch as any;
  fetchMock.mockClear();

  // We'll have the network error then a success - the retry should work
  fetchMock.mockRejectedValueOnce(new Error("Network error"));
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      accessToken: createJwt({ expired: false }),
      refreshToken: "new-refresh-token",
    }),
    text: async () => "",
  });

  // Mock UriHandler & Context
  const mockUriHandler = { event: new EventEmitter(), handleCallback: vi.fn() };
  const mockContext = {
    secrets: { store: vi.fn(), get: vi.fn() },
    subscriptions: [],
  };

  // Mock setInterval
  const originalSetInterval = global.setInterval;
  global.setInterval = vi.fn().mockReturnValue(123 as any);

  // Make sure Date.now returns a consistent value for our tests
  const originalDateNow = Date.now;
  const currentTime = Date.now();
  Date.now = vi.fn(() => currentTime);

  // Set up SecretStorage to return valid session
  mockSecretStorageGet.mockResolvedValue(JSON.stringify([validSession]));
  mockSecretStorageStore.mockClear();

  // Import and create provider
  const { WorkOsAuthProvider } = await import("./WorkOsAuthProvider");
  const provider1 = new WorkOsAuthProvider(mockContext, mockUriHandler);

  // Wait for async operations and trigger retry
  await new Promise(process.nextTick);
  await vi.runAllTimersAsync();
  await new Promise(process.nextTick);

  // For valid tokens with network errors, the session should NOT be removed due to retry
  expect(mockSecretStorageStore).not.toHaveBeenCalledWith(
    "workos.sessions",
    expect.stringMatching(/\[\]/),
  );

  // Clean up first provider
  if (provider1._refreshInterval) {
    clearInterval(provider1._refreshInterval);
    provider1._refreshInterval = null;
  }

  // SECOND SCENARIO: Expired token with refresh failure
  // Reset mocks
  fetchMock.mockClear();
  mockSecretStorageStore.mockClear();

  // Setup existing session with an EXPIRED token
  const expiredToken = createJwt({ expired: true });
  const expiredSession = {
    id: "expired-id",
    accessToken: expiredToken,
    refreshToken: "expired-refresh-token",
    expiresInMs: 3600000,
    account: { label: "Expired User", id: "expired@example.com" },
    scopes: [],
    loginNeeded: false,
  };

  // Setup fetch mock for expired token - same network error (should not retry)
  fetchMock.mockRejectedValueOnce(new Error("Network error"));

  // Set up SecretStorage to return expired session
  mockSecretStorageGet.mockResolvedValue(JSON.stringify([expiredSession]));

  // Create new provider with expired session
  const provider2 = new WorkOsAuthProvider(mockContext, mockUriHandler);

  // Wait for async operations (no need to run timers as we shouldn't retry)
  await new Promise(process.nextTick);

  // For expired tokens, a refresh failure should result in immediate session removal
  expect(mockSecretStorageStore).toHaveBeenCalledWith(
    "workos.sessions",
    expect.stringMatching(/\[\]/),
  );

  // Restore mocks
  global.setInterval = originalSetInterval;
  Date.now = originalDateNow;

  // Clean up second provider
  if (provider2._refreshInterval) {
    clearInterval(provider2._refreshInterval);
    provider2._refreshInterval = null;
  }
});

it("should implement exponential backoff for failed refresh attempts", async () => {
  // Setup existing sessions with a valid token
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

  // Setup fetch mock
  const fetchMock = fetch as any;
  fetchMock.mockClear();

  // Setup repeated network errors followed by success
  fetchMock.mockRejectedValueOnce(new Error("Network error 1"));
  fetchMock.mockRejectedValueOnce(new Error("Network error 2"));
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      accessToken: createJwt({ expired: false }),
      refreshToken: "new-refresh-token",
    }),
    text: async () => "",
  });

  // Create a mock UriHandler
  const mockUriHandler = {
    event: new EventEmitter(),
    handleCallback: vi.fn(),
  };

  // Create a mock ExtensionContext
  const mockContext = {
    secrets: {
      store: vi.fn(),
      get: vi.fn(),
    },
    subscriptions: [],
  };

  // Mock setInterval to prevent continuous refreshes
  const originalSetInterval = global.setInterval;
  global.setInterval = vi.fn().mockReturnValue(123 as any);

  // Track setTimeout calls
  const setTimeoutSpy = vi.spyOn(global, "setTimeout");

  // Set up our SecretStorage mock to return the session
  mockSecretStorageGet.mockResolvedValue(JSON.stringify([mockSession]));

  // Import WorkOsAuthProvider after setting up all mocks
  const { WorkOsAuthProvider } = await import("./WorkOsAuthProvider");

  // Create provider instance - this will automatically call refreshSessions
  const provider = new WorkOsAuthProvider(mockContext, mockUriHandler);

  // Wait for all promises to resolve for the initial refresh attempt
  await new Promise(process.nextTick);

  // Verify the first fetch attempt was made
  expect(fetchMock).toHaveBeenCalledTimes(1);

  // Trigger first retry
  vi.advanceTimersByTime(1000); // Initial backoff
  await new Promise(process.nextTick);

  // Verify the second fetch attempt was made
  expect(fetchMock).toHaveBeenCalledTimes(2);

  // Trigger second retry
  vi.advanceTimersByTime(2000); // Double the backoff
  await new Promise(process.nextTick);

  // Verify the third fetch attempt was made
  expect(fetchMock).toHaveBeenCalledTimes(3);

  // Verify setTimeout was called with increasing delays
  expect(setTimeoutSpy).toHaveBeenCalledTimes(2);

  // Check that the backoff periods increased
  const firstDelay = setTimeoutSpy.mock.calls[0][1];
  const secondDelay = setTimeoutSpy.mock.calls[1][1];

  // Check that backoff increased
  expect(secondDelay).toBeGreaterThan(firstDelay);

  // Restore setInterval
  global.setInterval = originalSetInterval;

  // Clean up
  if (provider._refreshInterval) {
    clearInterval(provider._refreshInterval);
    provider._refreshInterval = null;
  }
});
