import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadMcpFromHub } from "./hubLoader.js";

// Store original fetch to restore later
const originalFetch = global.fetch;
const mockFetch = vi.fn();

// Mock JSZip
vi.mock("jszip", () => {
  const MockJSZip = vi.fn();
  MockJSZip.prototype.loadAsync = vi.fn();
  return { default: MockJSZip };
});

describe("loadMcpFromHub", () => {
  let mockJSZip: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Set mock fetch for each test
    global.fetch = mockFetch;

    // Get the mocked JSZip constructor
    const JSZip = (await import("jszip")).default;
    mockJSZip = new JSZip();
  });

  afterEach(() => {
    // Restore original fetch after each test
    global.fetch = originalFetch;
  });

  it("should validate slug format", async () => {
    await expect(loadMcpFromHub("invalid-slug")).rejects.toThrow(
      'Invalid hub slug format. Expected "owner/package", got: invalid-slug',
    );
  });

  it("should handle HTTP errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    await expect(loadMcpFromHub("continuedev/nonexistent-mcp")).rejects.toThrow(
      'Failed to load mcp from hub "continuedev/nonexistent-mcp": HTTP 404: Not Found',
    );
  });

  it("should handle network errors", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    await expect(loadMcpFromHub("continuedev/test-mcp")).rejects.toThrow(
      'Failed to load mcp from hub "continuedev/test-mcp": Network error',
    );
  });

  it("should parse JSON configuration files", async () => {
    const mockConfig = {
      content:
        "name: test-mcp\ncommand: npx test-mcp\nargs:\n  - --port\n  - 3000",
    };

    // MCP packages now use the registry endpoint and return JSON directly
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(mockConfig),
    });

    const result = await loadMcpFromHub("continuedev/test-mcp");
    // Should now parse the YAML content and return the parsed object
    expect(result).toEqual({
      name: "test-mcp",
      command: "npx test-mcp",
      args: ["--port", 3000],
    });
  });

  it("should handle missing configuration files", async () => {
    // MCP packages now use the registry endpoint
    // If the content field is missing or empty, it should fail
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    });

    const result = await loadMcpFromHub("continuedev/no-config");
    // The registry endpoint might return an empty object if no config exists
    expect(result).toEqual({});
  });

  it("should handle invalid JSON configuration", async () => {
    // MCP packages now use the registry endpoint
    // If the registry returns invalid JSON, it should fail at the fetch level
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockRejectedValue(new Error("Invalid JSON")),
    });

    await expect(loadMcpFromHub("continuedev/invalid-json")).rejects.toThrow(
      'Failed to load mcp from hub "continuedev/invalid-json": Invalid JSON',
    );
  });
});
