import { vi } from "vitest";

// Mock auth functions
vi.mock("./auth/workos.js", () => ({
  loadAuthConfig: vi.fn(),
  getAccessToken: vi.fn(),
}));

import { getAccessToken, loadAuthConfig } from "./auth/workos.js";
import { processRule as processPromptOrRule } from "./hubLoader.js";
describe("processPromptOrRule (loadRuleFromHub integration)", () => {
  // Mock fetch for hub tests
  const originalFetch = global.fetch;
  const mockFetch = vi.fn() as any;

  beforeAll(() => {
    global.fetch = mockFetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    mockFetch.mockClear();
    // Reset auth mocks to not authenticated state
    (loadAuthConfig as any).mockReturnValue(null);
    (getAccessToken as any).mockReturnValue(null);
  });

  describe("loadRuleFromHub", () => {
    it("should successfully load a rule from the Continue Hub", async () => {
      // Create a mock zip file containing a markdown rule
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const ruleContent =
        "# Sentry Next.js Rule\n\nThis is a sample rule for Sentry integration with Next.js applications.";
      zip.file("rule.md", ruleContent);

      const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

      // Mock successful fetch response
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(zipBuffer),
      } as Response);

      const result = await processPromptOrRule("continuedev/sentry-nextjs");

      expect(result).toBe(ruleContent);
      expect(mockFetch).toHaveBeenCalledWith(
        new URL(
          "v0/continuedev/sentry-nextjs/latest/download",
          "https://api.continue.dev/",
        ),
        { headers: {} },
      );
    });

    it("should handle HTTP errors when loading from hub", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as Response);

      await expect(
        processPromptOrRule("continuedev/nonexistent-rule"),
      ).rejects.toThrow(
        'Failed to load rule from hub "continuedev/nonexistent-rule": HTTP 404: Not Found',
      );
    });

    it("should handle network errors when loading from hub", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      await expect(
        processPromptOrRule("continuedev/sentry-nextjs"),
      ).rejects.toThrow(
        'Failed to load rule from hub "continuedev/sentry-nextjs": Network error',
      );
    });

    it("should handle invalid slug format", async () => {
      // "invalid-slug" doesn't contain "/" so it's treated as direct content, not a hub slug
      // Let's test with a slug that has wrong format but contains "/"
      await expect(
        processPromptOrRule("invalid/slug/too/many/parts"),
      ).rejects.toThrow(
        'Invalid hub slug format. Expected "owner/package", got: invalid/slug/too/many/parts',
      );
    });

    it("should handle empty zip file", async () => {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(zipBuffer),
      } as Response);

      await expect(
        processPromptOrRule("continuedev/empty-rule"),
      ).rejects.toThrow(
        'Failed to load rule from hub "continuedev/empty-rule": No rule content found in downloaded zip file',
      );
    });

    it("should handle zip with only directories", async () => {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      zip.folder("docs"); // Create a directory but no files
      const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(zipBuffer),
      } as Response);

      await expect(
        processPromptOrRule("continuedev/directory-only"),
      ).rejects.toThrow(
        'Failed to load rule from hub "continuedev/directory-only": No rule content found in downloaded zip file',
      );
    });

    it("should prefer markdown files and ignore other file types", async () => {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const mdContent = "# Main Rule\n\nThis is the markdown rule content.";
      const txtContent = "This is just a text file.";

      zip.file("README.txt", txtContent);
      zip.file("rule.md", mdContent);
      zip.file("package.json", '{"name": "test"}');

      const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(zipBuffer),
      } as Response);

      const result = await processPromptOrRule("continuedev/mixed-files");

      expect(result).toBe(mdContent);
    });

    it("should handle multiple markdown files and use the first one", async () => {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const rule1Content = "# First Rule\n\nThis is the first rule.";
      const rule2Content = "# Second Rule\n\nThis is the second rule.";

      zip.file("rule1.md", rule1Content);
      zip.file("rule2.md", rule2Content);

      const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(zipBuffer),
      } as Response);

      const result = await processPromptOrRule("continuedev/multiple-rules");

      // Should use the first markdown file found (alphabetically)
      expect(result).toBe(rule1Content);
    });

    it("should handle malformed zip files", async () => {
      const invalidZipBuffer = new ArrayBuffer(10);

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(invalidZipBuffer),
      } as Response);

      await expect(
        processPromptOrRule("continuedev/corrupted-zip"),
      ).rejects.toThrow(
        'Failed to load rule from hub "continuedev/corrupted-zip"',
      );
    });
  });

  describe("processPromptOrRule logic", () => {
    it("should identify hub slugs correctly", async () => {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      zip.file("rule.md", "# Hub Rule");
      const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(zipBuffer),
      } as Response);

      const result = await processPromptOrRule("owner/package");
      expect(result).toBe("# Hub Rule");
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should treat direct strings as content", async () => {
      const directContent = "This is direct rule content";
      const result = await processPromptOrRule(directContent);
      expect(result).toBe(directContent);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should distinguish between hub slugs and file paths", async () => {
      // This would be treated as a file path, not a hub slug
      // since it starts with "."
      await expect(processPromptOrRule("./owner/package")).rejects.toThrow(
        'Failed to read rule file "./owner/package": Rule file not found',
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
