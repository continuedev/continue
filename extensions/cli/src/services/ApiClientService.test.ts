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
<<<<<<< HEAD
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
=======
    test("should initialize with api client", async () => {
      vi.mocked(config.getApiClient).mockReturnValue(mockApiClient as any);

      // Auth is always null now; doInitialize ignores the parameter
      const state = await service.initialize(null);
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))

      expect(state).toEqual({
        apiClient: mockApiClient,
      });
<<<<<<< HEAD
      expect(vi.mocked(config.getApiClient)).toHaveBeenCalledWith("test-token");
=======
      // Should be called with undefined (no auth token)
      expect(vi.mocked(config.getApiClient)).toHaveBeenCalledWith(undefined);
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
    });
  });

  describe("update()", () => {
<<<<<<< HEAD
    test("should update api client with new auth config", async () => {
      // Initialize first
      vi.mocked(config.getApiClient).mockReturnValue(null as any);
      await service.initialize({ accessToken: null } as any);

      // Update with new token
      vi.mocked(config.getApiClient).mockReturnValue(mockApiClient as any);
      const state = await service.update({ accessToken: "new-token" } as any);

      expect(state).toEqual({
        apiClient: mockApiClient,
=======
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
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
      });
      expect(service.getState()).toEqual(state);
    });

    test("should handle update errors", async () => {
<<<<<<< HEAD
      await service.initialize({ accessToken: null } as any);
=======
      vi.mocked(config.getApiClient).mockReturnValue(mockApiClient as any);
      await service.initialize(null);
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))

      vi.mocked(config.getApiClient).mockImplementation(() => {
        throw new Error("Failed to create client");
      });

<<<<<<< HEAD
      await expect(
        service.update({ accessToken: "bad-token" } as any),
      ).rejects.toThrow("Failed to create client");
=======
      await expect(service.update(null)).rejects.toThrow(
        "Failed to create client",
      );
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
    });
  });

  describe("isReady()", () => {
    test("should return false when not initialized", () => {
      expect(service.isReady()).toBe(false);
    });

<<<<<<< HEAD
    test("should return false when api client is null", async () => {
      vi.mocked(config.getApiClient).mockReturnValue(null as any);
      await service.initialize({ accessToken: null } as any);

      expect(service.isReady()).toBe(false);
    });

    test("should return true when api client exists", async () => {
      vi.mocked(config.getApiClient).mockReturnValue(mockApiClient as any);
      await service.initialize({ accessToken: "token" } as any);
=======
    test("should return true when api client exists", async () => {
      vi.mocked(config.getApiClient).mockReturnValue(mockApiClient as any);
      await service.initialize(null);
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))

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
<<<<<<< HEAD
      vi.mocked(config.getApiClient).mockReturnValue(null as any);
      await service.initialize({ accessToken: null } as any);
=======
      vi.mocked(config.getApiClient).mockReturnValue(mockApiClient as any);
      await service.initialize(null);
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))

      const listener = vi.fn();
      service.on("stateChanged", listener);

<<<<<<< HEAD
      vi.mocked(config.getApiClient).mockReturnValue(mockApiClient as any);
      await service.update({ accessToken: "new-token" } as any);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ apiClient: mockApiClient }),
        expect.objectContaining({ apiClient: null }),
=======
      const newMockApiClient = { ...mockApiClient, extra: true };
      vi.mocked(config.getApiClient).mockReturnValue(newMockApiClient as any);
      await service.update(null);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ apiClient: newMockApiClient }),
        expect.objectContaining({ apiClient: mockApiClient }),
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
      );
    });

    test("should emit error on update failure", async () => {
<<<<<<< HEAD
      await service.initialize({ accessToken: null } as any);
=======
      vi.mocked(config.getApiClient).mockReturnValue(mockApiClient as any);
      await service.initialize(null);
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))

      const errorListener = vi.fn();
      service.on("error", errorListener);

      const error = new Error("Update failed");
      vi.mocked(config.getApiClient).mockImplementation(() => {
        throw error;
      });

<<<<<<< HEAD
      await expect(
        service.update({ accessToken: "bad" } as any),
      ).rejects.toThrow();
=======
      await expect(service.update(null)).rejects.toThrow();
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
      expect(errorListener).toHaveBeenCalledWith(error);
    });
  });
});
