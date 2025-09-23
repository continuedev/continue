import { spawn } from "child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prTool } from "./pr.js";

// Mock child_process.spawn
vi.mock("child_process");
const mockSpawn = vi.mocked(spawn);

// Mock telemetry service
vi.mock("../telemetry/telemetryService.js", () => ({
  telemetryService: {
    recordPullRequestCreated: vi.fn(),
  },
}));

// Mock services - getService returns a Promise
vi.mock("../services/index.js", () => ({
  getService: vi.fn(),
  getServiceSync: vi.fn(),
  SERVICE_NAMES: {
    STORAGE_SYNC: "storageSync",
    AUTH: "auth",
  },
}));

// Mock env
vi.mock("../env.js", () => ({
  env: {
    apiBase: "https://api.continue.dev/",
  },
}));

// Mock formatError and logger
vi.mock("../util/formatError.js", () => ({
  formatError: vi.fn((e) => String(e)),
}));

vi.mock("../util/logger.js", () => ({
  logger: {
    debug: vi.fn(),
  },
}));

import { getService, getServiceSync } from "../services/index.js";
const mockGetService = vi.mocked(getService);
const mockGetServiceSync = vi.mocked(getServiceSync);

// Mock EventEmitter for child process
class MockChildProcess {
  stdout = { on: vi.fn() };
  stderr = { on: vi.fn() };
  on = vi.fn();
  kill = vi.fn();
}

describe("PR Tool", () => {
  // Helper to set up active agent session
  const setupActiveSession = (
    sessionId = "test-session-123",
    accessToken = "test-access-token",
  ) => {
    mockGetService.mockImplementation(async (serviceName: string) => {
      if (serviceName === "storageSync") {
        return {
          isEnabled: true,
          storageId: sessionId,
        };
      }
      if (serviceName === "auth") {
        return {
          authConfig: {
            accessToken,
          },
        };
      }
      throw new Error(`Service ${serviceName} not found`);
    });

    // Also mock getServiceSync for the tools index
    mockGetServiceSync.mockImplementation((serviceName: string) => {
      if (serviceName === "storageSync") {
        return {
          state: "ready",
          value: {
            isEnabled: true,
            storageId: sessionId,
          },
        };
      }
      return { state: "idle", value: null };
    });
  };

  // Helper to set up no active session
  const setupNoSession = () => {
    mockGetService.mockImplementation(async (serviceName: string) => {
      if (serviceName === "storageSync") {
        return {
          isEnabled: false,
          storageId: undefined,
        };
      }
      if (serviceName === "auth") {
        return {
          authConfig: {
            accessToken: "test-access-token",
          },
        };
      }
      throw new Error(`Service ${serviceName} not found`);
    });

    // Also mock getServiceSync for the tools index
    mockGetServiceSync.mockImplementation((serviceName: string) => {
      if (serviceName === "storageSync") {
        return {
          state: "ready",
          value: {
            isEnabled: false,
            storageId: undefined,
          },
        };
      }
      return { state: "idle", value: null };
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setupNoSession(); // Default to no active session
  });

  it("should have correct metadata", () => {
    expect(prTool.name).toBe("PR");
    expect(prTool.displayName).toBe("Create Pull Request");
    expect(prTool.isBuiltIn).toBe(true);
    expect(prTool.readonly).toBe(false);
    expect(prTool.parameters.required).toEqual(["title", "body"]);
    expect(prTool.parameters.properties).toHaveProperty("title");
    expect(prTool.parameters.properties).toHaveProperty("body");
    expect(prTool.parameters.properties).toHaveProperty("draft");
  });

  it("should validate required parameters in preprocess", async () => {
    await expect(prTool.preprocess!({ body: "test body" })).rejects.toThrow(
      "title is required and must be a non-empty string",
    );

    await expect(prTool.preprocess!({ title: "test title" })).rejects.toThrow(
      "body is required and must be a non-empty string",
    );

    await expect(
      prTool.preprocess!({ title: "", body: "test body" }),
    ).rejects.toThrow("title is required and must be a non-empty string");
  });

  it("should provide preview in preprocess", async () => {
    const mockChild = new MockChildProcess();
    mockSpawn.mockReturnValue(mockChild as any);

    // Mock successful git branch command
    process.nextTick(() => {
      mockChild.stdout.on.mock.calls[0][1]("feature-branch\n");
      mockChild.on.mock.calls.find(([event]) => event === "close")?.[1](0);
    });

    const result = await prTool.preprocess!({
      title: "Test PR Title",
      body: "Test PR Body",
    });

    expect(result.preview).toHaveLength(1);
    expect(result.preview![0].content).toContain("feature-branch");
    expect(result.preview![0].content).toContain("Test PR Title");
  });

  it("should handle draft parameter in preprocess", async () => {
    const mockChild = new MockChildProcess();
    mockSpawn.mockReturnValue(mockChild as any);

    // Mock successful git branch command
    process.nextTick(() => {
      mockChild.stdout.on.mock.calls[0][1]("feature-branch\n");
      mockChild.on.mock.calls.find(([event]) => event === "close")?.[1](0);
    });

    const result = await prTool.preprocess!({
      title: "Test PR Title",
      body: "Test PR Body",
      draft: true,
    });

    expect(result.preview![0].content).toContain("(as draft)");
  });

  it("should reject when no active agent session", async () => {
    setupNoSession();

    const result = await prTool.run({
      title: "Test PR",
      body: "Test description",
      draft: false,
    });

    expect(result).toContain(
      "PR tool is only available when running with an agent session ID",
    );
  });

  it("should execute gh pr create command successfully with agent session", async () => {
    setupActiveSession();

    // Mock fetch for agent session endpoint
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ metadata: { createdBySlug: "testuser" } }),
    });
    const mockChild = new MockChildProcess();
    mockSpawn.mockReturnValue(mockChild as any);

    let currentCall = 0;
    mockSpawn.mockImplementation(() => {
      const child = new MockChildProcess();
      currentCall++;

      process.nextTick(() => {
        if (currentCall === 1) {
          // First call: git branch --show-current
          child.stdout.on.mock.calls[0][1]("feature-branch\n");
          child.on.mock.calls.find(([event]) => event === "close")?.[1](0);
        } else {
          // Second call: gh pr create
          child.stdout.on.mock.calls[0][1](
            "https://github.com/owner/repo/pull/123\n",
          );
          child.on.mock.calls.find(([event]) => event === "close")?.[1](0);
        }
      });

      return child as any;
    });

    const result = await prTool.run({
      title: "Test PR",
      body: "Test description",
      draft: false,
    });

    expect(result).toContain("Successfully created pull request");
    expect(result).toContain("https://github.com/owner/repo/pull/123");

    // Verify gh command was called with correct arguments (including agent session info)
    const expectedBody =
      "Test description\n\n---\n\nThis [agent session](https://hub.continue.dev/agents/test-session-123) was created by testuser and co-authored by Continue <noreply@continue.dev>.";
    expect(mockSpawn).toHaveBeenCalledWith("gh", [
      "pr",
      "create",
      "--head",
      "feature-branch",
      "--title",
      "Test PR",
      "--body",
      expectedBody,
    ]);

    // Verify agent session API was called
    expect(global.fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        href: "https://api.continue.dev/agents/test-session-123",
      }),
      {
        method: "GET",
        headers: {
          Authorization: "Bearer test-access-token",
        },
      },
    );
  });

  it("should include draft flag when draft is true", async () => {
    setupActiveSession();

    // Mock fetch for agent session endpoint
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ metadata: { createdBySlug: "testuser" } }),
    });

    const mockChild = new MockChildProcess();
    mockSpawn.mockReturnValue(mockChild as any);

    let currentCall = 0;
    mockSpawn.mockImplementation(() => {
      const child = new MockChildProcess();
      currentCall++;

      process.nextTick(() => {
        if (currentCall === 1) {
          // First call: git branch --show-current
          child.stdout.on.mock.calls[0][1]("feature-branch\n");
          child.on.mock.calls.find(([event]) => event === "close")?.[1](0);
        } else {
          // Second call: gh pr create
          child.stdout.on.mock.calls[0][1](
            "https://github.com/owner/repo/pull/123\n",
          );
          child.on.mock.calls.find(([event]) => event === "close")?.[1](0);
        }
      });

      return child as any;
    });

    await prTool.run({
      title: "Test PR",
      body: "Test description",
      draft: true,
    });

    // Verify gh command was called with draft flag (including agent session info)
    const expectedBody =
      "Test description\n\n---\n\nThis [agent session](https://hub.continue.dev/agents/test-session-123) was created by testuser and co-authored by Continue <noreply@continue.dev>.";
    expect(mockSpawn).toHaveBeenCalledWith("gh", [
      "pr",
      "create",
      "--head",
      "feature-branch",
      "--title",
      "Test PR",
      "--body",
      expectedBody,
      "--draft",
    ]);
  });

  it("should handle git branch command failure", async () => {
    setupActiveSession();

    const mockChild = new MockChildProcess();
    mockSpawn.mockReturnValue(mockChild as any);

    // Mock failed git branch command
    process.nextTick(() => {
      mockChild.stderr.on.mock.calls[0][1]("fatal: not a git repository\n");
      mockChild.on.mock.calls.find(([event]) => event === "close")?.[1](128);
    });

    const result = await prTool.run({
      title: "Test PR",
      body: "Test description",
    });

    expect(result).toContain("Not in a git repository");
  });

  it("should add agent session info and standard suffix to PR body", async () => {
    setupActiveSession();

    // Mock fetch for agent session endpoint
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ metadata: { createdBySlug: "testuser" } }),
    });

    const mockChild = new MockChildProcess();
    mockSpawn.mockReturnValue(mockChild as any);

    let currentCall = 0;
    let capturedBody = "";
    mockSpawn.mockImplementation((...args) => {
      const child = new MockChildProcess();
      currentCall++;

      // Capture the body argument from gh pr create command
      if (currentCall === 2) {
        const [, ghArgs] = args;
        const bodyIndex = ghArgs.indexOf("--body");
        if (bodyIndex !== -1 && bodyIndex + 1 < ghArgs.length) {
          capturedBody = ghArgs[bodyIndex + 1];
        }
      }

      process.nextTick(() => {
        if (currentCall === 1) {
          // First call: git branch --show-current
          child.stdout.on.mock.calls[0][1]("feature-branch\n");
          child.on.mock.calls.find(([event]) => event === "close")?.[1](0);
        } else {
          // Second call: gh pr create
          child.stdout.on.mock.calls[0][1](
            "https://github.com/owner/repo/pull/123\n",
          );
          child.on.mock.calls.find(([event]) => event === "close")?.[1](0);
        }
      });

      return child as any;
    });

    await prTool.run({
      title: "Test PR",
      body: "Original PR description",
      draft: false,
    });

    // Verify the body contains original content, agent session info, and standard suffix
    expect(capturedBody).toContain("Original PR description");
    expect(capturedBody).toContain("agent session");
    expect(capturedBody).toContain(
      "https://hub.continue.dev/agents/test-session-123",
    );
    expect(capturedBody).toContain("created by testuser");
    expect(capturedBody).toContain(
      "co-authored by Continue <noreply@continue.dev>",
    );
    expect(capturedBody).toMatch(/---\n\nThis \[agent session\]/);
  });

  it("should handle gh command not found", async () => {
    setupActiveSession();

    const mockChild = new MockChildProcess();
    mockSpawn.mockReturnValue(mockChild as any);

    let currentCall = 0;
    mockSpawn.mockImplementation(() => {
      const child = new MockChildProcess();
      currentCall++;

      process.nextTick(() => {
        if (currentCall === 1) {
          // First call: git branch --show-current (success)
          child.stdout.on.mock.calls[0][1]("feature-branch\n");
          child.on.mock.calls.find(([event]) => event === "close")?.[1](0);
        } else {
          // Second call: gh pr create (command not found)
          child.stderr.on.mock.calls[0][1]("gh: command not found\n");
          child.on.mock.calls.find(([event]) => event === "close")?.[1](127);
        }
      });

      return child as any;
    });

    const result = await prTool.run({
      title: "Test PR",
      body: "Test description",
    });

    expect(result).toContain("GitHub CLI (gh) is not installed");
  });

  it("should handle agent session API failure gracefully", async () => {
    setupActiveSession();

    // Mock fetch failure for agent session endpoint
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    const mockChild = new MockChildProcess();
    mockSpawn.mockReturnValue(mockChild as any);

    let currentCall = 0;
    mockSpawn.mockImplementation(() => {
      const child = new MockChildProcess();
      currentCall++;

      process.nextTick(() => {
        if (currentCall === 1) {
          // First call: git branch --show-current
          child.stdout.on.mock.calls[0][1]("feature-branch\n");
          child.on.mock.calls.find(([event]) => event === "close")?.[1](0);
        } else {
          // Second call: gh pr create
          child.stdout.on.mock.calls[0][1](
            "https://github.com/owner/repo/pull/123\n",
          );
          child.on.mock.calls.find(([event]) => event === "close")?.[1](0);
        }
      });

      return child as any;
    });

    const result = await prTool.run({
      title: "Test PR",
      body: "Test description",
      draft: false,
    });

    expect(result).toContain("Successfully created pull request");

    // Verify the body still contains session info but no creator
    const expectedBody =
      "Test description\n\n---\n\nThis [agent session](https://hub.continue.dev/agents/test-session-123) was created by unknown and co-authored by Continue <noreply@continue.dev>.";
    expect(mockSpawn).toHaveBeenCalledWith("gh", [
      "pr",
      "create",
      "--head",
      "feature-branch",
      "--title",
      "Test PR",
      "--body",
      expectedBody,
    ]);
  });
});
