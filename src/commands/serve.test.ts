import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import request from "supertest";
import express from "express";

// Mock dependencies
jest.mock("../auth/workos.js", () => ({
  loadAuthConfig: jest.fn(() => null),
  ensureOrganization: jest.fn(),
  getOrganizationId: jest.fn(),
}));

jest.mock("../onboarding.js", () => ({
  runNormalFlow: jest.fn(() => Promise.resolve({
    config: {},
    llmApi: {},
    model: {},
  })),
}));

jest.mock("../session.js", () => ({
  saveSession: jest.fn(),
}));

jest.mock("../systemMessage.js", () => ({
  constructSystemMessage: jest.fn(() => Promise.resolve("System message")),
}));

jest.mock("../telemetry/telemetryService.js", () => ({
  recordSessionStart: jest.fn(),
  startActiveTime: jest.fn(),
  stopActiveTime: jest.fn(),
  updateOrganization: jest.fn(),
}));

jest.mock("../util/logger.js", () => ({
  error: jest.fn(),
  debug: jest.fn(),
}));

describe("serve command", () => {
  let originalProcessExit: typeof process.exit;

  beforeEach(() => {
    // Mock process.exit to prevent actual exit during tests
    originalProcessExit = process.exit;
    process.exit = jest.fn() as any;
  });

  afterEach(() => {
    // Restore original process.exit
    process.exit = originalProcessExit;
    jest.clearAllMocks();
  });

  it("should have /exit endpoint that returns success response", async () => {
    // Import serve after mocking dependencies
    const { serve } = await import("./serve.js");

    // Start server with a random port to avoid conflicts
    const port = Math.floor(Math.random() * 10000) + 30000;
    
    // Start the server in the background
    const serverPromise = serve(undefined, { port: port.toString() });
    
    // Give the server a moment to start
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      // Test the /exit endpoint
      const response = await request(`http://localhost:${port}`)
        .post("/exit")
        .expect(200);

      expect(response.body).toEqual({
        message: "Server shutting down",
        success: true,
      });

      // Give the server a moment to shut down
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify process.exit was called
      expect(process.exit).toHaveBeenCalledWith(0);
    } catch (error) {
      // If the test fails, we still want to try to clean up
      console.error("Test failed:", error);
      throw error;
    }
  }, 10000); // 10 second timeout for this test
});