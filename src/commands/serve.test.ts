import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import request from "supertest";
import type { Server } from "http";

// Mock fs to prevent file system checks
jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  existsSync: jest.fn(() => false),
}));

// Mock dependencies
jest.mock("../auth/workos.js", () => ({
  loadAuthConfig: jest.fn(() => null),
  ensureOrganization: jest.fn(),
  getOrganizationId: jest.fn(),
  isAuthenticated: jest.fn(() => false),
}));

jest.mock("../onboarding.js", () => ({
  runNormalFlow: jest.fn(() => Promise.resolve({
    config: { models: [] },
    llmApi: { chat: jest.fn() },
    model: { name: "test-model" },
  })),
  runOnboardingFlow: jest.fn(() => Promise.resolve({
    config: { models: [] },
    llmApi: { chat: jest.fn() },
    model: { name: "test-model" },
  })),
}));

jest.mock("../session.js", () => ({
  saveSession: jest.fn(),
}));

jest.mock("../systemMessage.js", () => ({
  constructSystemMessage: jest.fn(() => Promise.resolve("System message")),
}));

jest.mock("../telemetry/telemetryService.js", () => ({
  default: {
    recordSessionStart: jest.fn(),
    startActiveTime: jest.fn(),
    stopActiveTime: jest.fn(),
    updateOrganization: jest.fn(),
  }
}));

jest.mock("../util/logger.js", () => ({
  default: {
    error: jest.fn(),
    debug: jest.fn(),
  }
}));

// Mock chalk to prevent console output during tests
jest.mock("chalk", () => ({
  default: {
    green: (str: string) => str,
    dim: (str: string) => str,
    yellow: (str: string) => str,
    red: (str: string) => str,
  }
}));

describe("serve command", () => {
  let originalProcessExit: typeof process.exit;
  let serverPromise: Promise<void>;
  let serverRef: Server | null = null;

  beforeEach(() => {
    // Mock process.exit to prevent actual exit during tests
    originalProcessExit = process.exit;
    process.exit = jest.fn() as any;
    
    // Mock console.log to prevent output during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    // Restore original process.exit
    process.exit = originalProcessExit;
    
    // Restore console.log
    jest.restoreAllMocks();
    
    // Clean up server if it's still running
    if (serverRef) {
      await new Promise<void>((resolve) => {
        serverRef!.close(() => resolve());
      });
      serverRef = null;
    }
    
    jest.clearAllMocks();
  });

  it("should have /exit endpoint that returns success response", async () => {
    // Ensure mocks are properly set up
    jest.resetModules();
    
    // Mock environment to avoid config file lookup
    const originalEnv = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    
    // Import serve after mocking dependencies
    const { serve } = await import("./serve.js");

    // Start server with a random port to avoid conflicts
    const port = Math.floor(Math.random() * 10000) + 30000;
    
    // Create a promise to track when server is ready
    const serverReady = new Promise<void>((resolve) => {
      const originalListen = jest.spyOn(console, 'log');
      originalListen.mockImplementation((message: any) => {
        if (typeof message === 'string' && message.includes('Server started')) {
          resolve();
        }
      });
    });

    // Start the server in the background
    serverPromise = serve(undefined, { port: port.toString() });
    
    // Wait for server to be ready
    await serverReady;

    try {
      // Test the /exit endpoint
      const response = await request(`http://localhost:${port}`)
        .post("/exit")
        .expect(200);

      expect(response.body).toEqual({
        message: "Server shutting down",
        success: true,
      });

      // Wait for process.exit to be called
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify process.exit was called
      expect(process.exit).toHaveBeenCalledWith(0);
    } catch (error) {
      console.error("Test failed:", error);
      throw error;
    } finally {
      // Restore environment
      if (originalEnv) {
        process.env.ANTHROPIC_API_KEY = originalEnv;
      }
    }
  }, 20000); // Increased timeout to 20 seconds
});