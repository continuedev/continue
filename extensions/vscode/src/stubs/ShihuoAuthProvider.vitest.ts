// @ts-nocheck
import fetch from "node-fetch";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EventEmitter } from "vscode";

// Mock the modules we need
vi.mock("vscode", () => ({
  authentication: {
    registerAuthenticationProvider: vi.fn(),
    getSession: vi.fn(),
  },
  window: {
    registerUriHandler: vi.fn(),
    withProgress: vi.fn((options, callback) => callback()),
    showErrorMessage: vi.fn(),
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
    openExternal: vi.fn(),
  },
  Uri: {
    parse: vi.fn((uri) => ({ toString: () => uri })),
  },
}));

// Properly mock node-fetch
vi.mock("node-fetch", () => {
  return {
    __esModule: true,
    default: vi.fn(),
  };
});

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

// Mock promiseUtils
vi.mock("./promiseUtils", () => ({
  promiseFromEvent: vi.fn(() => ({
    promise: Promise.resolve("test-token"),
    cancel: { fire: vi.fn() },
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

it("should create a session successfully", async () => {
  // Setup fetch mock for successful token exchange
  const fetchMock = fetch as any;
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      code: 0,
      data: "test-access-token",
    }),
  });

  // Setup fetch mock for successful user info retrieval
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      code: 0,
      data: {
        user_info: {
          name: "Test User",
          email: "test@example.com",
        },
      },
    }),
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

  // Import ShihuoAuthProvider after setting up all mocks
  const { ShihuoAuthProvider } = await import("./ShihuoAuthProvider");

  // Create provider instance
  const provider = new ShihuoAuthProvider(mockContext, mockUriHandler);

  // Create a session
  const session = await provider.createSession([]);

  // Verify the session was created correctly
  expect(session).toBeDefined();
  expect(session.accessToken).toBe("test-access-token");
  expect(session.account.label).toBe("Test User");
  expect(session.account.id).toBe("test@example.com");
  expect(session.scopes).toEqual([]);
  expect(session.loginNeeded).toBe(false);

  // Verify that the session was stored
  expect(mockSecretStorageStore).toHaveBeenCalledWith(
    "shihuo-sso.sessions",
    expect.stringContaining("test-access-token"),
  );
});

it("should handle token exchange failure", async () => {
  // Setup fetch mock for failed token exchange
  const fetchMock = fetch as any;
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      code: 1,
      data: null,
    }),
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

  // Import ShihuoAuthProvider after setting up all mocks
  const { ShihuoAuthProvider } = await import("./ShihuoAuthProvider");

  // Create provider instance
  const provider = new ShihuoAuthProvider(mockContext, mockUriHandler);

  // Attempt to create a session - should throw an error
  await expect(provider.createSession([])).rejects.toThrow(
    "Failed to exchange code for token",
  );
});

it("should handle user info retrieval failure", async () => {
  // Setup fetch mock for successful token exchange
  const fetchMock = fetch as any;
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      code: 0,
      data: "test-access-token",
    }),
  });

  // Setup fetch mock for failed user info retrieval
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      code: 1,
      data: null,
    }),
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

  // Import ShihuoAuthProvider after setting up all mocks
  const { ShihuoAuthProvider } = await import("./ShihuoAuthProvider");

  // Create provider instance
  const provider = new ShihuoAuthProvider(mockContext, mockUriHandler);

  // Attempt to create a session - should throw an error
  await expect(provider.createSession([])).rejects.toThrow(
    "Failed to get user info",
  );
});

it("should get existing sessions", async () => {
  const mockSession = {
    id: "test-id",
    accessToken: "test-token",
    expiresInMs: 86400000, // 24 hours
    account: { label: "Test User", id: "test@example.com" },
    scopes: [],
    loginNeeded: false,
  };

  // Set up our SecretStorage mock to return the session
  mockSecretStorageGet.mockResolvedValue(JSON.stringify([mockSession]));

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

  // Import ShihuoAuthProvider after setting up all mocks
  const { ShihuoAuthProvider } = await import("./ShihuoAuthProvider");

  // Create provider instance
  const provider = new ShihuoAuthProvider(mockContext, mockUriHandler);

  // Get sessions
  const sessions = await provider.getSessions();

  // Verify the session was retrieved correctly
  expect(sessions).toHaveLength(1);
  expect(sessions[0]).toEqual(mockSession);
});

it("should remove sessions", async () => {
  const mockSession = {
    id: "test-id",
    accessToken: "test-token",
    expiresInMs: 86400000, // 24 hours
    account: { label: "Test User", id: "test@example.com" },
    scopes: [],
    loginNeeded: false,
  };

  // Set up our SecretStorage mock to return the session
  mockSecretStorageGet.mockResolvedValue(JSON.stringify([mockSession]));

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

  // Import ShihuoAuthProvider after setting up all mocks
  const { ShihuoAuthProvider } = await import("./ShihuoAuthProvider");

  // Create provider instance
  const provider = new ShihuoAuthProvider(mockContext, mockUriHandler);

  // Remove session
  await provider.removeSession("test-id");

  // Verify that the session was removed (empty array stored)
  expect(mockSecretStorageStore).toHaveBeenCalledWith(
    "shihuo-sso.sessions",
    "[]",
  );
});
