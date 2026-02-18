import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { machineIdSync } from "node-machine-id";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the auth module and node-machine-id
vi.mock("../auth/workos.js", () => ({
  loadAuthConfig: vi.fn(),
  isAuthenticatedConfig: vi.fn(),
}));

vi.mock("node-machine-id", () => {
  const mockFn = vi.fn(() => "test-machine-id");
  return {
    default: {
      machineIdSync: mockFn,
    },
    machineIdSync: mockFn,
  };
});

// Mock dns/promises for connection checks
vi.mock("dns/promises", () => {
  const lookup = vi.fn();
  return { default: { lookup } };
});

// eslint-disable-next-line import/order
import { isAuthenticatedConfig, loadAuthConfig } from "../auth/workos.js";
import { PosthogService } from "./posthogService.js";

describe("PosthogService", () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a temporary directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "posthog-test-"));

    // Mock os.homedir to return our temp directory
    vi.spyOn(os, "homedir").mockReturnValue(tempDir);

    // Clear environment variable
    delete process.env.CONTINUE_ALLOW_ANONYMOUS_TELEMETRY;

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });

    // Restore mocks
    vi.restoreAllMocks();
  });

  describe("uniqueId generation", () => {
    it("should use Continue user id when signed in", () => {
      const mockUserId = "user123";

      vi.mocked(loadAuthConfig).mockReturnValue({ userId: mockUserId } as any);
      vi.mocked(isAuthenticatedConfig).mockReturnValue(true);

      const service = new PosthogService();

      // Access private field for testing
      const uniqueId = (service as any).uniqueId;

      expect(uniqueId).toBe(mockUserId);
      expect(loadAuthConfig).toHaveBeenCalled();
      expect(isAuthenticatedConfig).toHaveBeenCalled();
    });

    it("should use machine id when not signed in", () => {
      const mockMachineId = "test-machine-id";

      vi.mocked(loadAuthConfig).mockReturnValue(null);
      vi.mocked(isAuthenticatedConfig).mockReturnValue(false);
      vi.mocked(machineIdSync).mockReturnValue(mockMachineId);

      const service = new PosthogService();

      // Access private field for testing
      const uniqueId = (service as any).uniqueId;

      expect(uniqueId).toBe(mockMachineId);
      expect(loadAuthConfig).toHaveBeenCalled();
      expect(isAuthenticatedConfig).toHaveBeenCalled();
      expect(machineIdSync).toHaveBeenCalled();
    });

    it("should use machine id when auth config is environment-based", () => {
      const mockMachineId = "test-machine-id";

      vi.mocked(loadAuthConfig).mockReturnValue({
        accessToken: "token",
      } as any);
      vi.mocked(isAuthenticatedConfig).mockReturnValue(false);
      vi.mocked(machineIdSync).mockReturnValue(mockMachineId);

      const service = new PosthogService();

      // Access private field for testing
      const uniqueId = (service as any).uniqueId;

      expect(uniqueId).toBe(mockMachineId);
      expect(machineIdSync).toHaveBeenCalled();
    });
  });

  describe("telemetry enabled/disabled", () => {
    it("should be enabled by default", () => {
      const service = new PosthogService();
      expect(service.isEnabled).toBe(true);
    });

    it("should be disabled when CONTINUE_ALLOW_ANONYMOUS_TELEMETRY is 0", () => {
      process.env.CONTINUE_ALLOW_ANONYMOUS_TELEMETRY = "0";
      const service = new PosthogService();
      expect(service.isEnabled).toBe(false);
    });
  });

  describe("hasInternetConnection and offline client", () => {
    let service: PosthogService;

    beforeEach(() => {
      service = new PosthogService();
    });

    it("returns false on DNS error, caches and refetches", async () => {
      const dns: any = (await import("dns/promises")).default;
      dns.lookup.mockRejectedValueOnce(new Error("offline"));
      const first = await (service as any).hasInternetConnection();
      expect(first).toBe(false);
      dns.lookup.mockResolvedValueOnce({
        address: "1.1.1.1",
        family: 4,
      } as any);
      await (service as any).hasInternetConnection();
      const second = (service as any)._hasInternetConnection;
      expect(second).toBe(true);
      expect(dns.lookup).toHaveBeenCalledTimes(2);
    });

    it("getClient returns undefined when offline", async () => {
      const dns: any = (await import("dns/promises")).default;
      dns.lookup.mockRejectedValueOnce(new Error("offline"));
      const client = await (service as any).getClient();
      expect(client).toBeUndefined();
      expect(dns.lookup).toHaveBeenCalledTimes(1);
    });

    it("returns false when DNS resolves to 0.0.0.0 (blocked)", async () => {
      const dns: any = (await import("dns/promises")).default;
      dns.lookup.mockResolvedValueOnce({
        address: "0.0.0.0",
        family: 4,
      } as any);
      const result = await (service as any).hasInternetConnection();
      expect(result).toBe(false);
      expect(dns.lookup).toHaveBeenCalledTimes(1);
    });

    it("returns false when DNS resolves to localhost", async () => {
      const dns: any = (await import("dns/promises")).default;
      dns.lookup.mockResolvedValueOnce({
        address: "127.0.0.1",
        family: 4,
      } as any);
      const result = await (service as any).hasInternetConnection();
      expect(result).toBe(false);
      expect(dns.lookup).toHaveBeenCalledTimes(1);
    });

    it("returns true when DNS resolves to valid address", async () => {
      const dns: any = (await import("dns/promises")).default;
      dns.lookup.mockResolvedValueOnce({
        address: "1.1.1.1",
        family: 4,
      } as any);
      const result = await (service as any).hasInternetConnection();
      expect(result).toBe(true);
      expect(dns.lookup).toHaveBeenCalledTimes(1);
    });
  });
});
