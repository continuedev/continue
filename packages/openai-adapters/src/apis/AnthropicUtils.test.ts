import { vi } from "vitest";
import {
  getAnthropicHeaders,
  isAzureAnthropicEndpoint,
} from "./AnthropicUtils.js";

describe("isAzureAnthropicEndpoint", () => {
  describe("should return true for Azure endpoints", () => {
    it("detects Azure AI Foundry endpoint", () => {
      expect(
        isAzureAnthropicEndpoint(
          "https://my-resource.services.ai.azure.com/anthropic",
        ),
      ).toBe(true);
    });

    it("detects Azure Cognitive Services endpoint", () => {
      expect(
        isAzureAnthropicEndpoint(
          "https://my-resource.cognitiveservices.azure.com/anthropic",
        ),
      ).toBe(true);
    });

    it("handles case insensitivity", () => {
      expect(
        isAzureAnthropicEndpoint(
          "https://my-resource.SERVICES.AI.AZURE.COM/anthropic",
        ),
      ).toBe(true);
    });

    it("handles mixed case", () => {
      expect(
        isAzureAnthropicEndpoint(
          "https://My-Resource.Services.AI.Azure.Com/anthropic/v1/messages",
        ),
      ).toBe(true);
    });
  });

  describe("should return false for non-Azure endpoints", () => {
    it("returns false for standard Anthropic endpoint", () => {
      expect(isAzureAnthropicEndpoint("https://api.anthropic.com")).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isAzureAnthropicEndpoint(undefined)).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isAzureAnthropicEndpoint("")).toBe(false);
    });

    it("returns false for invalid URL", () => {
      expect(isAzureAnthropicEndpoint("not-a-valid-url")).toBe(false);
    });

    it("returns false for other providers", () => {
      expect(isAzureAnthropicEndpoint("https://api.openai.com/v1")).toBe(false);
    });
  });

  describe("URL parsing security", () => {
    it("rejects Azure pattern in path (not hostname)", () => {
      // This should NOT match - Azure domain is in path, not hostname
      expect(
        isAzureAnthropicEndpoint(
          "https://evil.com/services.ai.azure.com/anthropic",
        ),
      ).toBe(false);
    });

    it("rejects Azure pattern as subdomain of non-Azure domain", () => {
      expect(
        isAzureAnthropicEndpoint(
          "https://services.ai.azure.com.evil.com/anthropic",
        ),
      ).toBe(false);
    });
  });
});

describe("getAnthropicHeaders", () => {
  describe("authentication header", () => {
    it("uses x-api-key for standard Anthropic endpoint", () => {
      const headers = getAnthropicHeaders(
        "test-key",
        false,
        "https://api.anthropic.com",
      );
      expect(headers["x-api-key"]).toBe("test-key");
      expect(headers["api-key"]).toBeUndefined();
    });

    it("uses api-key for Azure AI Foundry endpoint", () => {
      const headers = getAnthropicHeaders(
        "azure-key",
        false,
        "https://my-resource.services.ai.azure.com/anthropic",
      );
      expect(headers["api-key"]).toBe("azure-key");
      expect(headers["x-api-key"]).toBeUndefined();
    });

    it("uses api-key for Azure Cognitive Services endpoint", () => {
      const headers = getAnthropicHeaders(
        "azure-key",
        false,
        "https://my-resource.cognitiveservices.azure.com/anthropic",
      );
      expect(headers["api-key"]).toBe("azure-key");
      expect(headers["x-api-key"]).toBeUndefined();
    });

    it("uses x-api-key when apiBase is undefined", () => {
      const headers = getAnthropicHeaders("test-key", false, undefined);
      expect(headers["x-api-key"]).toBe("test-key");
      expect(headers["api-key"]).toBeUndefined();
    });
  });

  describe("caching headers", () => {
    it("includes anthropic-beta header when caching is enabled", () => {
      const headers = getAnthropicHeaders("test-key", true);
      expect(headers["anthropic-beta"]).toBe("prompt-caching-2024-07-31");
    });

    it("does not include anthropic-beta header when caching is disabled", () => {
      const headers = getAnthropicHeaders("test-key", false);
      expect(headers["anthropic-beta"]).toBeUndefined();
    });

    it("includes caching header for Azure endpoints too", () => {
      const headers = getAnthropicHeaders(
        "azure-key",
        true,
        "https://my-resource.services.ai.azure.com/anthropic",
      );
      expect(headers["anthropic-beta"]).toBe("prompt-caching-2024-07-31");
    });
  });

  describe("standard headers", () => {
    it("always includes anthropic-version header", () => {
      const headers = getAnthropicHeaders("test-key", false);
      expect(headers["anthropic-version"]).toBe("2023-06-01");
    });

    it("always includes Content-Type and Accept headers", () => {
      const headers = getAnthropicHeaders("test-key", false);
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["Accept"]).toBe("application/json");
    });
  });

  describe("key/endpoint mismatch warning", () => {
    it("warns when Azure endpoint is used with Anthropic-style key", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      getAnthropicHeaders(
        "sk-ant-test-key",
        false,
        "https://my-resource.services.ai.azure.com/anthropic",
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Azure endpoint detected"),
      );
      warnSpy.mockRestore();
    });

    it("does not warn when Azure endpoint is used with Azure key", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      getAnthropicHeaders(
        "azure-api-key-12345",
        false,
        "https://my-resource.services.ai.azure.com/anthropic",
      );
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("does not warn when standard Anthropic endpoint is used with Anthropic key", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      getAnthropicHeaders(
        "sk-ant-test-key",
        false,
        "https://api.anthropic.com",
      );
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});
