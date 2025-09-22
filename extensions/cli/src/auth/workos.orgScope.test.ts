import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { ensureOrganization, isEnvironmentAuthConfig } from "./workos.js";

describe("ensureOrganization with API key org scope", () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch as any;
  });

  it("resolves organizationId via auth/scope for API key auth", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ organizationId: "org_123" }),
    });
    (global as any).fetch = mockFetch;

    const envAuthConfig = {
      accessToken: "sk_test_api_key",
      organizationId: null as string | null,
    } as const;

    const result = await ensureOrganization(envAuthConfig, true);
    expect(result).not.toBeNull();
    if (result && isEnvironmentAuthConfig(result)) {
      expect(result.organizationId).toBe("org_123");
    } else {
      throw new Error("Expected environment auth config result");
    }
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("keeps organizationId null if endpoint not available", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false });
    (global as any).fetch = mockFetch;

    const envAuthConfig = {
      accessToken: "sk_test_api_key",
      organizationId: null as string | null,
    } as const;

    const result = await ensureOrganization(envAuthConfig, true);
    expect(result).not.toBeNull();
    if (result && isEnvironmentAuthConfig(result)) {
      expect(result.organizationId).toBeNull();
    } else {
      throw new Error("Expected environment auth config result");
    }
    expect(mockFetch).toHaveBeenCalledOnce();
  });
});
