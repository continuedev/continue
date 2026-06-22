import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadMcpFromHub } from "./hubLoader.js";

// Integration test to demonstrate the --mcp flag functionality
describe("--mcp flag integration", () => {
  beforeEach(() => {
    // Clear process.argv before each test
    process.argv = ["node", "test"];
    vi.clearAllMocks();
  });

<<<<<<< HEAD
  it("should validate MCP slug format", async () => {
    // Test that invalid slug formats are rejected
    await expect(loadMcpFromHub("invalid-slug")).rejects.toThrow(
      'Invalid hub slug format. Expected "owner/package", got: invalid-slug',
    );

    // Valid format should not throw during validation step
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });
    global.fetch = mockFetch;

    // This will fail at the HTTP level, not validation level
    await expect(loadMcpFromHub("valid/slug")).rejects.toThrow(
      'Failed to load mcp from hub "valid/slug": HTTP 404: Not Found',
=======
  it("should reject all hub loading since hub has been removed", async () => {
    await expect(loadMcpFromHub("invalid-slug")).rejects.toThrow(
      "Hub package loading has been removed.",
    );

    await expect(loadMcpFromHub("valid/slug")).rejects.toThrow(
      "Hub package loading has been removed.",
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
    );
  });
});
