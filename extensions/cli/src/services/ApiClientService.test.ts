import { describe, expect, test, beforeEach, vi } from "vitest";

// Mock the config module
vi.mock("../config.js");
import * as config from "../config.js";

import { ApiClientService } from "./ApiClientService.js";

describe("ApiClientService", () => {
  let service: ApiClientService;
  const mockApiClient = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    service = new ApiClientService();
  });

  describe("State Management", () => {
    test("should initialize with null api client", async () => {
      vi.mocked(config.getApiClient).mockReturnValue(null as any);

      const state = await service.initialize({ accessToken: null } as any);

      expect(state).toEqual({
        apiClient: null,
      });
    });

    test("should initialize with api client when token provided", async () => {
      vi.mocked(config.getApiClient).mockReturnValue(mockApiClient as any);

      const state = await service.initialize({
        accessToken: "test-token",
      } as any);

      expect(state).toEqual({
        apiClient: mockApiClient,
      });
      expect(vi.mocked(config.getApiClient)).toHaveBeenCalledWith("test-token");
    });
  });

  describe("update()", () => {
    test("should update api client with new auth config", async () => {
      // Initialize first
      vi.mocked(config.getApiClient).mockReturnValue(null as any);
      await service.initialize({ accessToken: null } as any);

      // Update with new token
      vi.mocked(config.getApiClient).mockReturnValue(mockApiClient as any);
      const state = await service.update({ accessToken: "new-token" } as any);

      expect(state).toEqual({
        apiClient: mockApiClient,
      });
      expect(service.getState()).toEqual(state);
    });

    test("should handle update errors", async () => {
      await service.initialize({ accessToken: null } as any);

      vi.mocked(config.getApiClient).mockImplementation(() => {
        throw new Error("Failed to create client");
      });

      await expect(
        service.update({ accessToken: "bad-token" } as any),
      ).rejects.toThrow("Failed to create client");
    });
  });

  describe("isReady()", () => {
    test("should return false when not initialized", () => {
      expect(service.isReady()).toBe(false);
    });

    test("should return false when api client is null", async () => {
      vi.mocked(config.getApiClient).mockReturnValue(null as any);
      await service.initialize({ accessToken: null } as any);

      expect(service.isReady()).toBe(false);
    });

    test("should return true when api client exists", async () => {
      vi.mocked(config.getApiClient).mockReturnValue(mockApiClient as any);
      await service.initialize({ accessToken: "token" } as any);

      expect(service.isReady()).toBe(true);
    });
  });

  describe("getDependencies()", () => {
    test("should declare auth dependency", () => {
      expect(service.getDependencies()).toEqual(["auth"]);
    });
  });

  describe("Event Emission", () => {
    test("should emit stateChanged on update", async () => {
      vi.mocked(config.getApiClient).mockReturnValue(null as any);
      await service.initialize({ accessToken: null } as any);

      const listener = vi.fn();
      service.on("stateChanged", listener);

      vi.mocked(config.getApiClient).mockReturnValue(mockApiClient as any);
      await service.update({ accessToken: "new-token" } as any);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ apiClient: mockApiClient }),
        expect.objectContaining({ apiClient: null }),
      );
    });

    test("should emit error on update failure", async () => {
      await service.initialize({ accessToken: null } as any);

      const errorListener = vi.fn();
      service.on("error", errorListener);

      const error = new Error("Update failed");
      vi.mocked(config.getApiClient).mockImplementation(() => {
        throw error;
      });

      await expect(
        service.update({ accessToken: "bad" } as any),
      ).rejects.toThrow();
      expect(errorListener).toHaveBeenCalledWith(error);
    });
  });
});
