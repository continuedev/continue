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
    test("should initialize with api client", async () => {
      vi.mocked(config.getApiClient).mockReturnValue(mockApiClient as any);

      // Auth is always null now; doInitialize ignores the parameter
      const state = await service.initialize(null);

      expect(state).toEqual({
        apiClient: mockApiClient,
      });
      // Should be called with undefined (no auth token)
      expect(vi.mocked(config.getApiClient)).toHaveBeenCalledWith(undefined);
    });
  });

  describe("update()", () => {
    test("should update api client", async () => {
      // Initialize first
      vi.mocked(config.getApiClient).mockReturnValue(mockApiClient as any);
      await service.initialize(null);

      // Update
      const newMockApiClient = { ...mockApiClient, extra: true };
      vi.mocked(config.getApiClient).mockReturnValue(newMockApiClient as any);
      const state = await service.update(null);

      expect(state).toEqual({
        apiClient: newMockApiClient,
      });
      expect(service.getState()).toEqual(state);
    });

    test("should handle update errors", async () => {
      vi.mocked(config.getApiClient).mockReturnValue(mockApiClient as any);
      await service.initialize(null);

      vi.mocked(config.getApiClient).mockImplementation(() => {
        throw new Error("Failed to create client");
      });

      await expect(service.update(null)).rejects.toThrow(
        "Failed to create client",
      );
    });
  });

  describe("isReady()", () => {
    test("should return false when not initialized", () => {
      expect(service.isReady()).toBe(false);
    });

    test("should return true when api client exists", async () => {
      vi.mocked(config.getApiClient).mockReturnValue(mockApiClient as any);
      await service.initialize(null);

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
      vi.mocked(config.getApiClient).mockReturnValue(mockApiClient as any);
      await service.initialize(null);

      const listener = vi.fn();
      service.on("stateChanged", listener);

      const newMockApiClient = { ...mockApiClient, extra: true };
      vi.mocked(config.getApiClient).mockReturnValue(newMockApiClient as any);
      await service.update(null);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ apiClient: newMockApiClient }),
        expect.objectContaining({ apiClient: mockApiClient }),
      );
    });

    test("should emit error on update failure", async () => {
      vi.mocked(config.getApiClient).mockReturnValue(mockApiClient as any);
      await service.initialize(null);

      const errorListener = vi.fn();
      service.on("error", errorListener);

      const error = new Error("Update failed");
      vi.mocked(config.getApiClient).mockImplementation(() => {
        throw error;
      });

      await expect(service.update(null)).rejects.toThrow();
      expect(errorListener).toHaveBeenCalledWith(error);
    });
  });
});
