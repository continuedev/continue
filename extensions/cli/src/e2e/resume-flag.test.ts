import * as fs from "fs/promises";
import * as path from "path";

import {
  cleanupTestContext,
  createTestContext,
  runCLI,
} from "../test-helpers/cli-helpers.js";
import {
  cleanupMockLLMServer,
  setupMockLLMTest,
  type MockLLMServer,
} from "../test-helpers/mock-llm-server.js";

describe("E2E: Resume Flag", () => {
  let context: any;
  let mockServer: MockLLMServer;

  beforeEach(async () => {
    context = await createTestContext();
    mockServer = await setupMockLLMTest(context, {
      response: "Hello! Nice to meet you.",
    });
  });

  afterEach(async () => {
    await cleanupMockLLMServer(mockServer);
    await cleanupTestContext(context);
  });

  it("should resume from previous session when using --resume flag", async () => {
    // First, run a chat session with a single message
    const firstResult = await runCLI(context, {
      args: ["-p", "--config", context.configPath, "hello"],
      env: {
        // Use a fixed session ID so both CLI calls use the same session
        CONTINUE_CLI_TEST_SESSION_ID: "test-session-123",
        CONTINUE_GLOBAL_DIR: path.join(context.testDir, ".continue"),
      },
      timeout: 15000,
    });

    // Verify the first session completed successfully
    expect(firstResult.exitCode).toBe(0);
    expect(firstResult.stdout).toContain("Hello! Nice to meet you.");

    // Verify that a session file was created
    const sessionDir = path.join(context.testDir, ".continue", "sessions");

    // Ensure session directory exists
    try {
      await fs.mkdir(sessionDir, { recursive: true });
    } catch (error) {
      // Directory already exists, continue
    }

    const sessionFiles = (await fs.readdir(sessionDir)).filter(
      (f) => f.endsWith(".json") && f !== "sessions.json",
    );
    expect(sessionFiles).toHaveLength(1);

    // Read the session file to verify it contains our conversation
    const sessionFile = sessionFiles[0];
    const sessionPath = path.join(sessionDir, sessionFile);
    const sessionContent = await fs.readFile(sessionPath, "utf-8");
    const sessionData = JSON.parse(sessionContent);

    expect(sessionData.history).toBeDefined();
    expect(sessionData.history.length).toBeGreaterThan(0);

    // Should contain the user message and assistant response
    const userMessage = sessionData.history.find(
      (msg: any) => msg.message?.role === "user",
    );
    const assistantMessage = sessionData.history.find(
      (msg: any) => msg.message?.role === "assistant",
    );

    expect(userMessage?.message?.content).toBe("hello");
    expect(assistantMessage?.message?.content).toBe("Hello! Nice to meet you.");

    // Now run with --resume flag using the same session ID
    // Use -p flag to run in headless mode (tests don't have TTY)
    const resumeResult = await runCLI(context, {
      args: ["-p", "--resume", "--config", context.configPath],
      env: {
        CONTINUE_CLI_TEST_SESSION_ID: "test-session-123",
        CONTINUE_GLOBAL_DIR: path.join(context.testDir, ".continue"),
      },
      timeout: 15000,
    });

    // The resume command should complete successfully
    expect(resumeResult.exitCode).toBe(0);

    // In headless mode with no new prompt, it should just show existing messages
    // This is a simplification for the test - the behavior may vary based on implementation
  }, 30000);

  it("should handle --resume when no previous session exists", async () => {
    // Try to resume without any previous session
    // Use -p flag to run in headless mode (tests don't have TTY)
    const result = await runCLI(context, {
      args: ["-p", "--resume", "--config", context.configPath],
      env: {
        CONTINUE_CLI_TEST_SESSION_ID: "no-session-456",
        CONTINUE_GLOBAL_DIR: path.join(context.testDir, ".continue"),
      },
      timeout: 15000,
    });

    // Should handle gracefully (either start new session or show appropriate message)
    expect(result.exitCode).toBe(0);
  }, 20000);

  it("should resume and allow new messages to be added", async () => {
    // Setup mock to return different responses for different calls
    let responseCount = 0;

    // Clean up current server first
    await cleanupMockLLMServer(mockServer);

    // Wait a bit to ensure cleanup
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Create new server with dynamic response
    mockServer = await setupMockLLMTest(context, {
      response: (prompt: string) => {
        responseCount++;
        if (responseCount === 1) {
          return "First response";
        } else {
          return "Second response";
        }
      },
    });

    const sessionId = "test-session-789";

    // First session
    const firstResult = await runCLI(context, {
      args: ["-p", "--config", context.configPath, "first message"],
      env: {
        CONTINUE_CLI_TEST_SESSION_ID: sessionId,
        CONTINUE_GLOBAL_DIR: path.join(context.testDir, ".continue"),
      },
      timeout: 15000,
    });

    expect(firstResult.exitCode).toBe(0);
    expect(firstResult.stdout).toContain("First response");

    // Verify the first session was saved correctly
    const sessionDir = path.join(context.testDir, ".continue", "sessions");

    // Ensure session directory exists
    try {
      await fs.mkdir(sessionDir, { recursive: true });
    } catch (error) {
      // Directory already exists, continue
    }

    let sessionFiles = (await fs.readdir(sessionDir)).filter(
      (f) => f.endsWith(".json") && f !== "sessions.json",
    );
    expect(sessionFiles).toHaveLength(1);

    let sessionFile = sessionFiles[0];
    let sessionPath = path.join(sessionDir, sessionFile);
    let sessionContent = await fs.readFile(sessionPath, "utf-8");
    let sessionData = JSON.parse(sessionContent);

    // Resume and add a new message with the SAME session ID
    const resumeResult = await runCLI(context, {
      args: [
        "--resume",
        "-p",
        "--config",
        context.configPath,
        "second message",
      ],
      env: {
        CONTINUE_CLI_TEST_SESSION_ID: sessionId,
        CONTINUE_GLOBAL_DIR: path.join(context.testDir, ".continue"),
      },
      timeout: 15000,
    });

    expect(resumeResult.exitCode).toBe(0);
    // Should show the new response
    expect(resumeResult.stdout).toContain("Second response");

    // Verify both requests were made to the server
    expect(mockServer.requests).toHaveLength(2);

    // Check that the session file contains both messages
    sessionFiles = (await fs.readdir(sessionDir)).filter(
      (f) => f.endsWith(".json") && f !== "sessions.json",
    );
    sessionFile = sessionFiles[0];
    sessionPath = path.join(sessionDir, sessionFile);
    sessionContent = await fs.readFile(sessionPath, "utf-8");
    sessionData = JSON.parse(sessionContent);

    const userMessages = sessionData.history.filter(
      (msg: any) => msg.message?.role === "user",
    );
    const assistantMessages = sessionData.history.filter(
      (msg: any) => msg.message?.role === "assistant",
    );

    expect(userMessages).toHaveLength(2);
    expect(assistantMessages).toHaveLength(2);
    expect(userMessages[0].message?.content).toBe("first message");
    expect(userMessages[1].message?.content).toBe("second message");
    expect(assistantMessages[0].message?.content).toBe("First response");
    expect(assistantMessages[1].message?.content).toBe("Second response");
  }, 30000);
});
