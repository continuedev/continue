import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadMcpFromHub } from "./hubLoader.js";

// Integration test to demonstrate the --mcp flag functionality
describe("--mcp flag integration", () => {
  beforeEach(() => {
    // Clear process.argv before each test
    process.argv = ["node", "test"];
    vi.clearAllMocks();
  });

  it("should reject all hub loading since hub has been removed", async () => {
    await expect(loadMcpFromHub("invalid-slug")).rejects.toThrow(
      "Hub package loading has been removed.",
    );

    await expect(loadMcpFromHub("valid/slug")).rejects.toThrow(
      "Hub package loading has been removed.",
    );
  });
});
