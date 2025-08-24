import { describe, expect, it } from "vitest";

describe("Process SIGINT handling functions", () => {
  it("exports the necessary functions for exit message handling", async () => {
    const indexModule = await import("../index.js");

    // Verify the functions exist
    expect(typeof indexModule.shouldShowExitMessage).toBe("function");
    expect(typeof indexModule.setExitMessageCallback).toBe("function");
    expect(typeof indexModule.setTUIUnmount).toBe("function");
  });
});
