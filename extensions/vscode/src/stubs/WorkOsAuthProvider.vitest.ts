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

  // Clean up
  if (provider._refreshInterval) {
    clearInterval(provider._refreshInterval);
    provider._refreshInterval = null;
  }
});
