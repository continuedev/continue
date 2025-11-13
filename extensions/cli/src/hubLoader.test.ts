import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAccessToken, loadAuthConfig } from "./auth/workos.js";
import * as hubLoader from "./hubLoader.js";

// Mock auth functions
vi.mock("./auth/workos.js", () => ({
  loadAuthConfig: vi.fn(),
  getAccessToken: vi.fn(),
}));

const {
  loadPackageFromHub,
  mcpProcessor,
  modelProcessor,
  promptProcessor,
  ruleProcessor,
  processRule,
} = hubLoader;

// Store the original fetch before any mocking
const originalFetch = global.fetch;

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock JSZip
vi.mock("jszip", () => ({
  default: vi.fn(),
}));

const mockedJSZip = vi.fn();

describe("hubLoader", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset auth mocks to default state
    (loadAuthConfig as any).mockReturnValue(null);
    (getAccessToken as any).mockReturnValue(null);
  });

  describe("loadPackageFromHub", () => {
    it("should validate slug format", async () => {
      await expect(
        loadPackageFromHub("invalid-slug", ruleProcessor),
      ).rejects.toThrow(
        'Invalid hub slug format. Expected "owner/package", got: invalid-slug',
      );
    });

    it("should handle HTTP errors", async () => {
      (loadAuthConfig as any).mockReturnValue(null);
      (getAccessToken as any).mockReturnValue(null);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      await expect(
        loadPackageFromHub("owner/package", ruleProcessor),
      ).rejects.toThrow(
        'Failed to load rule from hub "owner/package": HTTP 404: Not Found',
      );
    });

    it("should make request without auth headers when not authenticated", async () => {
      (loadAuthConfig as any).mockReturnValue(null);
      (getAccessToken as any).mockReturnValue(null);

      const JSZipModule = await import("jszip");
      const JSZip = JSZipModule.default;

      if (typeof (JSZip as any).mockImplementation === "function") {
        (JSZip as any).mockImplementation(() => ({
          loadAsync: vi.fn().mockResolvedValueOnce({
            files: {
              "README.md": {
                dir: false,
                async: vi.fn().mockResolvedValue("rule content"),
              },
            },
          }),
        }));
      } else {
        return;
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      });

      await loadPackageFromHub("owner/rule", ruleProcessor);

      expect(mockFetch).toHaveBeenCalledWith(expect.any(URL), { headers: {} });
    });

    it("should include Authorization header when authenticated", async () => {
      const mockAuthConfig = {
        accessToken: "test-token-123",
        userId: "user123",
      };
      (loadAuthConfig as any).mockReturnValue(mockAuthConfig);
      (getAccessToken as any).mockReturnValue("test-token-123");

      const JSZipModule = await import("jszip");
      const JSZip = JSZipModule.default;

      if (typeof (JSZip as any).mockImplementation === "function") {
        (JSZip as any).mockImplementation(() => ({
          loadAsync: vi.fn().mockResolvedValueOnce({
            files: {
              "README.md": {
                dir: false,
                async: vi.fn().mockResolvedValue("rule content"),
              },
            },
          }),
        }));
      } else {
        return;
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      });

      await loadPackageFromHub("owner/rule", ruleProcessor);

      expect(mockFetch).toHaveBeenCalledWith(expect.any(URL), {
        headers: {
          Authorization: "Bearer test-token-123",
        },
      });
    });

    it("should include Authorization header for MCP requests when authenticated", async () => {
      const mockAuthConfig = {
        accessToken: "test-token-456",
        userId: "user456",
      };
      (loadAuthConfig as any).mockReturnValue(mockAuthConfig);
      (getAccessToken as any).mockReturnValue("test-token-456");

      const mcpConfig = {
        content: "name: test-mcp\nversion: 1.0.0",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mcpConfig),
      });

      await loadPackageFromHub("owner/mcp", mcpProcessor);

      expect(mockFetch).toHaveBeenCalledWith(expect.any(URL), {
        headers: {
          Authorization: "Bearer test-token-456",
        },
      });
    });

    it("should load rule content", async () => {
      (loadAuthConfig as any).mockReturnValue(null);
      (getAccessToken as any).mockReturnValue(null);

      const ruleContent = "# Test Rule\n\nThis is a test rule.";

      // Check if JSZip is mocked
      const JSZipModule = await import("jszip");
      const JSZip = JSZipModule.default;

      // Since JSZip is mocked, it should be a mock function
      if (typeof (JSZip as any).mockImplementation === "function") {
        (JSZip as any).mockImplementation(() => ({
          loadAsync: vi.fn().mockResolvedValueOnce({
            files: {
              "README.md": {
                dir: false,
                async: vi.fn().mockResolvedValue(ruleContent),
              },
            },
          }),
        }));
      } else {
        // If mock doesn't work, skip this test
        return;
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      });

      const result = await loadPackageFromHub("owner/rule", ruleProcessor);
      expect(result).toBe(ruleContent);
    });

    it("should load MCP configuration", async () => {
      (loadAuthConfig as any).mockReturnValue(null);
      (getAccessToken as any).mockReturnValue(null);

      const mcpConfig = {
        content: "name: test-mcp\nversion: 1.0.0",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mcpConfig),
      });

      const result = await loadPackageFromHub("owner/mcp", mcpProcessor);
      // Should parse the YAML content, not return the wrapper
      expect(result).toEqual({
        name: "test-mcp",
        version: "1.0.0",
      });
    });

    it("should handle missing files", async () => {
      (loadAuthConfig as any).mockReturnValue(null);
      (getAccessToken as any).mockReturnValue(null);

      // Check if JSZip is mocked
      const JSZipModule = await import("jszip");
      const JSZip = JSZipModule.default;

      // Since JSZip is mocked, it should be a mock function
      if (typeof (JSZip as any).mockImplementation === "function") {
        (JSZip as any).mockImplementation(() => ({
          loadAsync: vi.fn().mockResolvedValueOnce({
            files: {
              "other.txt": {
                dir: false,
                async: vi.fn().mockResolvedValue("not a rule"),
              },
            },
          }),
        }));
      } else {
        // If mock doesn't work, skip this test
        return;
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      });

      await expect(
        loadPackageFromHub("owner/empty", ruleProcessor),
      ).rejects.toThrow(
        'Failed to load rule from hub "owner/empty": No rule content found in downloaded zip file. Expected files with extensions: .md',
      );
    });
  });

  describe("processRule", () => {
    beforeEach(() => {
      // Ensure mocks are set up properly for processRule tests
      global.fetch = mockFetch;
    });

    it("should treat multi-line strings as inline rules", async () => {
      const loadRuleSpy = vi
        .spyOn(hubLoader, "loadRuleFromHub")
        .mockResolvedValue("hub-content");

      const multilineRule = "Line one\nEnsure /tmp is ignored\nFinal line";
      const result = await processRule(multilineRule);

      expect(result).toBe(multilineRule);
      expect(loadRuleSpy).not.toHaveBeenCalled();

      loadRuleSpy.mockRestore();
    });

    it("should still treat owner/package strings as hub slugs", async () => {
      // Mock fetch to return a proper response for this test
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      zip.file("rule.md", "hub-content");
      const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(zipBuffer),
      } as Response);

      const slug = "owner/package";
      const result = await processRule(slug);

      expect(result).toBe("hub-content");
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe("processors", () => {
    it("should define rule processor correctly", () => {
      expect(ruleProcessor.type).toBe("rule");
      expect(ruleProcessor.expectedFileExtensions).toEqual([".md"]);
      expect(ruleProcessor.parseContent("test content", "test.md")).toBe(
        "test content",
      );
    });

    it("should define MCP processor correctly", () => {
      expect(mcpProcessor.type).toBe("mcp");
      expect(mcpProcessor.expectedFileExtensions).toEqual([
        ".json",
        ".yaml",
        ".yml",
      ]);
    });

    it("should define model processor correctly", () => {
      expect(modelProcessor.type).toBe("model");
      expect(modelProcessor.expectedFileExtensions).toEqual([
        ".json",
        ".yaml",
        ".yml",
      ]);
    });

    it("should define prompt processor correctly", () => {
      expect(promptProcessor.type).toBe("prompt");
      expect(promptProcessor.expectedFileExtensions).toEqual([".md", ".txt"]);
      expect(promptProcessor.parseContent("test content", "test.md")).toBe(
        "test content",
      );
    });
  });

  describe("Real Hub Integration Tests", () => {
    // Restore real fetch and JSZip for these tests
    beforeEach(async () => {
      vi.clearAllMocks();
      // Restore the original fetch
      global.fetch = originalFetch;
      // Unmock JSZip to use the real implementation
      vi.unmock("jszip");
    });

    it("should load rule from real hub: sanity/sanity-opinionated", async () => {
      const result = await loadPackageFromHub(
        "sanity/sanity-opinionated",
        ruleProcessor,
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
      // Rules are markdown, should contain some markdown elements
      expect(result).toMatch(/[#\-\*]/);
    }, 30000);

    it("should load MCP from real hub: upstash/context7-mcp", async () => {
      // Restore real fetch and JSZip for this test
      global.fetch = originalFetch;
      vi.unmock("jszip");

      const testSlug = "upstash/context7-mcp";
      const result = await loadPackageFromHub(testSlug, mcpProcessor);

      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
      // Should now return the parsed MCP configuration
      expect(result).toHaveProperty("name");
      expect(typeof result.name).toBe("string");
      // The MCP should have type and url properties
      expect(result).toHaveProperty("type");
      expect(result).toHaveProperty("url");
    }, 30000);

    it("should load model from real hub: openai/gpt-5", async () => {
      // Restore real fetch and JSZip for this test
      global.fetch = originalFetch;
      vi.unmock("jszip");

      const testSlug = "openai/gpt-5";
      const result = await loadPackageFromHub(testSlug, modelProcessor);

      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
      // Should now return the extracted model from the models array
      expect(result).toHaveProperty("name");
      expect(result).toHaveProperty("provider");
      expect(result).toHaveProperty("model");
      // Check that the model properties are correct
      expect(result.provider).toBe("openai");
      expect(result.model).toBe("gpt-5");
      expect(result.name).toBe("GPT-5");
    }, 30000);

    it("should load prompt from real hub: launchdarkly/using-flags", async () => {
      const result = await loadPackageFromHub(
        "launchdarkly/using-flags",
        promptProcessor,
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    }, 30000);
  });
});
