import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  ApiRequestError,
  AuthenticationRequiredError,
  del,
  get,
  makeAuthenticatedRequest,
  post,
  put,
} from "./apiClient.js";

// Mock the dependencies
vi.mock("../auth/workos.js", () => ({
  loadAuthConfig: vi.fn(),
  getAccessToken: vi.fn(),
}));

vi.mock("../env.js", () => ({
  env: {
    apiBase: "https://api.continue.dev",
  },
}));

vi.mock("./logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock fetch globally
global.fetch = vi.fn();

describe("apiClient", () => {
  let mockLoadAuthConfig: any;
  let mockGetAccessToken: any;
  const mockFetch = vi.mocked(global.fetch);

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get mocked functions
    const authModule = await import("../auth/workos.js");
    mockLoadAuthConfig = vi.mocked(authModule.loadAuthConfig);
    mockGetAccessToken = vi.mocked(authModule.getAccessToken);

    // Setup default successful authentication
    mockLoadAuthConfig.mockReturnValue({ some: "config" });
    mockGetAccessToken.mockReturnValue("test-access-token");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("makeAuthenticatedRequest", () => {
    test("should make successful API request", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: { get: vi.fn().mockReturnValue("application/json") },
        json: vi.fn().mockResolvedValue({ data: "test" }),
      } as unknown as Response);

      const result = await makeAuthenticatedRequest("test-endpoint", {
        method: "POST",
        body: { key: "value" },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        new URL("test-endpoint", "https://api.continue.dev"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-access-token",
          },
          body: JSON.stringify({ key: "value" }),
        },
      );

      expect(result).toEqual({
        data: { data: "test" },
        status: 200,
        ok: true,
      });
    });

    test("should handle non-JSON response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: { get: vi.fn().mockReturnValue("text/plain") },
        text: vi.fn().mockResolvedValue("plain text response"),
      } as unknown as Response);

      const result = await makeAuthenticatedRequest("test-endpoint");

      expect(result.data).toBe("plain text response");
    });

    test("should throw AuthenticationRequiredError when no auth config", async () => {
      mockLoadAuthConfig.mockReturnValue(null);

      await expect(makeAuthenticatedRequest("test-endpoint")).rejects.toThrow(
        AuthenticationRequiredError,
      );
    });

    test("should throw AuthenticationRequiredError when no access token", async () => {
      mockGetAccessToken.mockReturnValue(null);

      await expect(makeAuthenticatedRequest("test-endpoint")).rejects.toThrow(
        AuthenticationRequiredError,
      );
    });

    test("should throw ApiRequestError on API error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        headers: { get: vi.fn() },
        text: vi.fn().mockResolvedValue("Resource not found"),
      } as unknown as Response);

      await expect(makeAuthenticatedRequest("test-endpoint")).rejects.toThrow(
        ApiRequestError,
      );
    });

    test("should handle network error", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      await expect(makeAuthenticatedRequest("test-endpoint")).rejects.toThrow(
        "Request failed: Network error",
      );
    });

    test("should handle string body", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: { get: vi.fn().mockReturnValue("application/json") },
        json: vi.fn().mockResolvedValue({ success: true }),
      } as unknown as Response);

      await makeAuthenticatedRequest("test-endpoint", {
        method: "POST",
        body: "raw string body",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(URL),
        expect.objectContaining({
          body: "raw string body",
        }),
      );
    });

    test("should merge custom headers", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: { get: vi.fn().mockReturnValue("application/json") },
        json: vi.fn().mockResolvedValue({}),
      } as unknown as Response);

      await makeAuthenticatedRequest("test-endpoint", {
        headers: { "Custom-Header": "custom-value" },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(URL),
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-access-token",
            "Custom-Header": "custom-value",
          },
        }),
      );
    });
  });

  describe("convenience methods", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: { get: vi.fn().mockReturnValue("application/json") },
        json: vi.fn().mockResolvedValue({ success: true }),
      } as unknown as Response);
    });

    test("get method should make GET request", async () => {
      await get("test-endpoint");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(URL),
        expect.objectContaining({ method: "GET" }),
      );
    });

    test("post method should make POST request", async () => {
      await post("test-endpoint", { data: "test" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(URL),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ data: "test" }),
        }),
      );
    });

    test("put method should make PUT request", async () => {
      await put("test-endpoint", { data: "test" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(URL),
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ data: "test" }),
        }),
      );
    });

    test("del method should make DELETE request", async () => {
      await del("test-endpoint");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(URL),
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  describe("error classes", () => {
    test("AuthenticationRequiredError should have correct properties", () => {
      const error = new AuthenticationRequiredError();

      expect(error.name).toBe("AuthenticationRequiredError");
      expect(error.message).toBe(
        "Not authenticated. Please run 'cn login' first.",
      );
    });

    test("AuthenticationRequiredError should accept custom message", () => {
      const customMessage = "Custom auth error";
      const error = new AuthenticationRequiredError(customMessage);

      expect(error.message).toBe(customMessage);
    });

    test("ApiRequestError should have correct properties", () => {
      const error = new ApiRequestError(404, "Not Found", "Resource not found");

      expect(error.name).toBe("ApiRequestError");
      expect(error.status).toBe(404);
      expect(error.statusText).toBe("Not Found");
      expect(error.response).toBe("Resource not found");
      expect(error.message).toContain("404");
      expect(error.message).toContain("Not Found");
      expect(error.message).toContain("Resource not found");
    });

    test("ApiRequestError should work without response text", () => {
      const error = new ApiRequestError(500, "Internal Server Error");

      expect(error.response).toBeUndefined();
      expect(error.message).toContain("500");
      expect(error.message).toContain("Internal Server Error");
      expect(error.message).not.toContain("undefined");
    });
  });
});
