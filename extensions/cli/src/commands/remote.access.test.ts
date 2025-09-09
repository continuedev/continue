import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock console.log to prevent output during tests
const mockConsoleLog = vi.fn();
const mockProcessExit = vi.fn();

// Mock the process.exit function
vi.stubGlobal('console', {
  ...console,
  log: mockConsoleLog,
});

// Mock process.exit
Object.defineProperty(process, 'exit', {
  value: mockProcessExit,
  writable: true,
});

// Mock the auth module
vi.mock("../auth/workos.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../auth/workos.js")>();
  return {
    ...actual,
    loadAuthConfig: vi.fn(),
    isAuthenticatedConfig: vi.fn(),
  };
});

import { loadAuthConfig, isAuthenticatedConfig } from "../auth/workos.js";

import { canAccessAgents } from "./remote.js";

describe("canAccessAgents access control", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return false when no auth config exists", async () => {
    (loadAuthConfig as any).mockReturnValue(null);

    const result = await canAccessAgents();

    expect(result).toBe(false);
  });

  it("should return false for environment auth (CONTINUE_API_KEY)", async () => {
    const envAuthConfig = {
      accessToken: "test-token",
      organizationId: null,
    };

    (loadAuthConfig as any).mockReturnValue(envAuthConfig);
    (isAuthenticatedConfig as any).mockReturnValue(false);

    const result = await canAccessAgents();

    expect(result).toBe(false);
  });

  it("should return true for @continue.dev email addresses", async () => {
    const authConfig = {
      userId: "test-user",
      userEmail: "test@continue.dev",
      accessToken: "test-token",
      refreshToken: "test-refresh",
      expiresAt: Date.now() + 3600000,
      organizationId: null,
    };

    (loadAuthConfig as any).mockReturnValue(authConfig);
    (isAuthenticatedConfig as any).mockReturnValue(true);

    const result = await canAccessAgents();

    expect(result).toBe(true);
  });

  it("should return false for non-@continue.dev email addresses", async () => {
    const authConfig = {
      userId: "test-user",
      userEmail: "test@example.com",
      accessToken: "test-token",
      refreshToken: "test-refresh",
      expiresAt: Date.now() + 3600000,
      organizationId: null,
    };

    (loadAuthConfig as any).mockReturnValue(authConfig);
    (isAuthenticatedConfig as any).mockReturnValue(true);

    const result = await canAccessAgents();

    expect(result).toBe(false);
  });

  it("should return false when userEmail is undefined", async () => {
    const authConfig = {
      userId: "test-user",
      userEmail: undefined,
      accessToken: "test-token",
      refreshToken: "test-refresh",
      expiresAt: Date.now() + 3600000,
      organizationId: null,
    };

    (loadAuthConfig as any).mockReturnValue(authConfig);
    (isAuthenticatedConfig as any).mockReturnValue(true);

    const result = await canAccessAgents();

    expect(result).toBe(false);
  });

  it("should return false when userEmail is null", async () => {
    const authConfig = {
      userId: "test-user",
      userEmail: null,
      accessToken: "test-token",
      refreshToken: "test-refresh",
      expiresAt: Date.now() + 3600000,
      organizationId: null,
    };

    (loadAuthConfig as any).mockReturnValue(authConfig);
    (isAuthenticatedConfig as any).mockReturnValue(true);

    const result = await canAccessAgents();

    expect(result).toBe(false);
  });

  it("should handle edge case: empty string email", async () => {
    const authConfig = {
      userId: "test-user",
      userEmail: "",
      accessToken: "test-token",
      refreshToken: "test-refresh",
      expiresAt: Date.now() + 3600000,
      organizationId: null,
    };

    (loadAuthConfig as any).mockReturnValue(authConfig);
    (isAuthenticatedConfig as any).mockReturnValue(true);

    const result = await canAccessAgents();

    expect(result).toBe(false);
  });

  it("should handle case sensitivity correctly", async () => {
    const authConfig = {
      userId: "test-user",
      userEmail: "test@CONTINUE.DEV",
      accessToken: "test-token",
      refreshToken: "test-refresh",
      expiresAt: Date.now() + 3600000,
      organizationId: null,
    };

    (loadAuthConfig as any).mockReturnValue(authConfig);
    (isAuthenticatedConfig as any).mockReturnValue(true);

    const result = await canAccessAgents();

    // Should return false because domain case doesn't match exactly
    expect(result).toBe(false);
  });
});