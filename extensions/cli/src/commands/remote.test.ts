import { beforeEach, describe, expect, it, vi } from "vitest";

import { remote } from "./remote.js";

// Mock dependencies
vi.mock("../auth/workos.js");
vi.mock("../env.js");
vi.mock("../telemetry/telemetryService.js");
vi.mock("../ui/index.js");
vi.mock("../util/git.js");
vi.mock("../util/exit.js");

const mockWorkos = vi.mocked(await import("../auth/workos.js"));
const mockEnv = vi.mocked(await import("../env.js"));
const mockGit = vi.mocked(await import("../util/git.js"));
const mockStartRemoteTUIChat = vi.mocked(await import("../ui/index.js"));
const mockExit = vi.mocked(await import("../util/exit.js"));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Mock console methods
const mockConsoleInfo = vi.fn();
const mockConsoleError = vi.fn();
const mockConsoleLog = vi.fn();
global.console = {
  ...global.console,
  info: mockConsoleInfo,
  error: mockConsoleError,
  log: mockConsoleLog,
};

describe("remote command", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Clear GitHub Actions environment variables
    delete process.env.GITHUB_ACTIONS;
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.GITHUB_SERVER_URL;

    // Setup default mocks
    mockWorkos.loadAuthConfig.mockReturnValue({
      userId: "test-user-id",
      userEmail: "test@example.com",
      accessToken: "test-token",
      refreshToken: "test-refresh-token",
      expiresAt: Date.now() + 3600000,
      organizationId: null,
    });

    mockWorkos.isAuthenticatedConfig.mockReturnValue(true);
    mockWorkos.getAccessToken.mockReturnValue("test-token");

    mockEnv.env = {
      apiBase: "https://api.example.com",
      workOsClientId: "test-client-id",
      appUrl: "https://test.example.com",
      continueHome: "/tmp/test-continue-home",
    };

    mockGit.getRepoUrl.mockReturnValue("https://github.com/user/test-repo.git");

    mockFetch.mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          name === "content-type" ? "application/json" : null,
      },
      json: async () => ({
        id: "test-agent-id",
        url: "ws://test-url.com",
        port: 8080,
      }),
    });

    mockStartRemoteTUIChat.startRemoteTUIChat.mockResolvedValue({} as any);

    // Mock gracefulExit to prevent process.exit during tests
    mockExit.gracefulExit.mockResolvedValue(undefined);
  });

  it("should include idempotency key in request body when provided", async () => {
    const testIdempotencyKey = "test-idempotency-key-123";

    await remote("test prompt", { idempotencyKey: testIdempotencyKey });

    expect(mockFetch).toHaveBeenCalledWith(
      new URL("agents", mockEnv.env.apiBase),
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: expect.stringContaining(
          `"idempotencyKey":"${testIdempotencyKey}"`,
        ),
      }),
    );
  });

  it("should not include idempotency key in request body when not provided", async () => {
    await remote("test prompt", {});

    expect(mockFetch).toHaveBeenCalledWith(
      new URL("agents", mockEnv.env.apiBase),
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: expect.not.stringContaining("idempotencyKey"),
      }),
    );
  });

  it("should work with direct URL connection and idempotency key", async () => {
    const testUrl = "ws://direct-url.com";
    const testIdempotencyKey = "direct-key-789";

    await remote("test prompt", {
      url: testUrl,
      idempotencyKey: testIdempotencyKey,
    });

    // Should not make POST request when connecting directly to URL
    expect(mockFetch).not.toHaveBeenCalled();

    // Should connect directly to the provided URL
    expect(mockStartRemoteTUIChat.startRemoteTUIChat).toHaveBeenCalledWith(
      testUrl,
      "test prompt",
    );
  });

  it("should ignore --start flag when --url is provided without --start", async () => {
    const testUrl = "ws://direct-url.com";

    await remote("test prompt", { url: testUrl });

    // Should not make POST request when connecting directly to URL
    expect(mockFetch).not.toHaveBeenCalled();

    // Should connect directly to the provided URL and start TUI
    expect(mockStartRemoteTUIChat.startRemoteTUIChat).toHaveBeenCalledWith(
      testUrl,
      "test prompt",
    );

    // Should not output JSON
    expect(mockConsoleLog).not.toHaveBeenCalled();
  });

  it("should fetch tunnel and connect when id option is provided", async () => {
    const agentId = "agent-789";

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name: string) =>
            name === "content-type" ? "application/json" : null,
        },
        json: async () => ({ url: "ws://tunnel-url.com", port: 9090 }),
      })
      .mockResolvedValue({
        ok: true,
        headers: {
          get: (name: string) =>
            name === "content-type" ? "application/json" : null,
        },
        json: async () => ({
          id: "test-agent-id",
          url: "ws://test-url.com",
          port: 8080,
        }),
      });

    await remote("test prompt", { id: agentId });

    expect(mockFetch).toHaveBeenCalledWith(
      new URL(`agents/${agentId}/tunnel`, mockEnv.env.apiBase),
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
      }),
    );

    expect(mockStartRemoteTUIChat.startRemoteTUIChat).toHaveBeenCalledWith(
      "ws://tunnel-url.com",
      "test prompt",
    );
  });

  it("should output JSON without starting TUI when using --id with --start", async () => {
    const agentId = "agent-456";
    const tunnelResponse = { url: "ws://existing-tunnel.com", port: 7070 };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: (name: string) =>
          name === "content-type" ? "application/json" : null,
      },
      json: async () => tunnelResponse,
    });

    await remote("test prompt", { id: agentId, start: true });

    expect(mockFetch).toHaveBeenCalledWith(
      new URL(`agents/${agentId}/tunnel`, mockEnv.env.apiBase),
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
      }),
    );

    expect(mockStartRemoteTUIChat.startRemoteTUIChat).not.toHaveBeenCalled();
    expect(mockConsoleLog).toHaveBeenCalledWith(
      JSON.stringify({
        status: "success",
        message: "Remote agent tunnel connection details",
        url: tunnelResponse.url,
        containerPort: tunnelResponse.port,
        agentId,
        mode: "existing_agent",
      }),
    );
  });

  it("should handle proper request body structure with all fields", async () => {
    const testIdempotencyKey = "structured-test-key";

    await remote("test prompt", { idempotencyKey: testIdempotencyKey });

    const fetchCall = mockFetch.mock.calls[0];
    const requestBody = JSON.parse(fetchCall[1].body);

    expect(requestBody).toEqual({
      repoUrl: "https://github.com/user/test-repo.git",
      name: expect.stringMatching(/^devbox-\d+$/),
      prompt: "test prompt",
      idempotencyKey: testIdempotencyKey,
    });
  });

  it("should call getRepoUrl to get the current repository URL", async () => {
    await remote("test prompt", {});

    expect(mockGit.getRepoUrl).toHaveBeenCalled();
  });

  it("should work correctly in GitHub Actions environment", async () => {
    // Simulate GitHub Actions environment
    process.env.GITHUB_ACTIONS = "true";
    process.env.GITHUB_REPOSITORY = "myorg/myrepo";

    // Mock getRepoUrl to return the GitHub Actions URL
    mockGit.getRepoUrl.mockReturnValue("https://github.com/myorg/myrepo.git");

    await remote("test prompt", { idempotencyKey: "github-actions-key" });

    const fetchCall = mockFetch.mock.calls[0];
    const requestBody = JSON.parse(fetchCall[1].body);

    expect(requestBody.repoUrl).toBe("https://github.com/myorg/myrepo.git");
    expect(requestBody.idempotencyKey).toBe("github-actions-key");
  });

  it("should include branchName in request body when branch option is provided", async () => {
    const testBranch = "feature/new-feature";

    await remote("test prompt", { branch: testBranch });

    expect(mockFetch).toHaveBeenCalledWith(
      new URL("agents", mockEnv.env.apiBase),
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: expect.stringContaining(`"branchName":"${testBranch}"`),
      }),
    );
  });

  it("should not include branchName in request body when branch option is not provided", async () => {
    await remote("test prompt", {});

    expect(mockFetch).toHaveBeenCalledWith(
      new URL("agents", mockEnv.env.apiBase),
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: expect.not.stringContaining("branchName"),
      }),
    );
  });

  it("should handle proper request body structure with branch field", async () => {
    const testBranch = "main";
    const testIdempotencyKey = "test-with-branch";

    await remote("test prompt", {
      branch: testBranch,
      idempotencyKey: testIdempotencyKey,
    });

    const fetchCall = mockFetch.mock.calls[0];
    const requestBody = JSON.parse(fetchCall[1].body);

    expect(requestBody).toEqual({
      repoUrl: "https://github.com/user/test-repo.git",
      name: expect.stringMatching(/^devbox-\d+$/),
      prompt: "test prompt",
      idempotencyKey: testIdempotencyKey,
      branchName: testBranch,
      agent: undefined,
      config: undefined,
    });
  });

  it("should include config in request body when config option is provided", async () => {
    const testConfig = "test-config-path";

    await remote("test prompt", { config: testConfig });

    expect(mockFetch).toHaveBeenCalledWith(
      new URL("agents", mockEnv.env.apiBase),
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: expect.stringContaining(`"config":"${testConfig}"`),
      }),
    );

    expect(mockFetch).toHaveBeenCalledWith(
      new URL("agents", mockEnv.env.apiBase),
      expect.objectContaining({
        body: expect.stringContaining(`"config":"${testConfig}"`),
      }),
    );
  });

  it("should include agent in request body when agent option is provided", async () => {
    const testAgent = "test-agent";

    await remote("test prompt", { agent: testAgent });

    expect(mockFetch).toHaveBeenCalledWith(
      new URL("agents", mockEnv.env.apiBase),
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: expect.stringContaining(`"agent":"${testAgent}"`),
      }),
    );

    expect(mockFetch).toHaveBeenCalledWith(
      new URL("agents", mockEnv.env.apiBase),
      expect.objectContaining({
        body: expect.stringContaining(`"agent":"${testAgent}"`),
      }),
    );
  });

  it("should handle proper request body structure with config field", async () => {
    const testConfig = "my-agent-config";
    const testIdempotencyKey = "test-with-config";

    await remote("test prompt", {
      config: testConfig,
      idempotencyKey: testIdempotencyKey,
    });

    const fetchCall = mockFetch.mock.calls[0];
    const requestBody = JSON.parse(fetchCall[1].body);

    expect(requestBody).toEqual({
      repoUrl: "https://github.com/user/test-repo.git",
      name: expect.stringMatching(/^devbox-\d+$/),
      prompt: "test prompt",
      idempotencyKey: testIdempotencyKey,
      config: testConfig,
    });
  });

  it("should handle proper request body structure with agent field", async () => {
    const testAgent = "my-agent";
    const testIdempotencyKey = "test-with-config";

    await remote("test prompt", {
      agent: testAgent,
      idempotencyKey: testIdempotencyKey,
    });

    const fetchCall = mockFetch.mock.calls[0];
    const requestBody = JSON.parse(fetchCall[1].body);

    expect(requestBody).toEqual({
      repoUrl: "https://github.com/user/test-repo.git",
      name: expect.stringMatching(/^devbox-\d+$/),
      prompt: "test prompt",
      idempotencyKey: testIdempotencyKey,
      agent: testAgent,
    });
  });

  it("should not include config in request body when config option is not provided", async () => {
    await remote("test prompt", {});

    const fetchCall = mockFetch.mock.calls[0];
    const requestBody = JSON.parse(fetchCall[1].body);

    expect(requestBody).toEqual({
      repoUrl: "https://github.com/user/test-repo.git",
      name: expect.stringMatching(/^devbox-\d+$/),
      prompt: "test prompt",
      agent: undefined,
      config: undefined,
    });
    expect(requestBody).not.toHaveProperty("idempotencyKey");
  });

  describe("start mode (-s / --start flag)", () => {
    it("should output JSON and exit without starting TUI when using --start with direct URL", async () => {
      const testUrl = "ws://test-url.com";

      await remote("test prompt", { url: testUrl, start: true });

      // Should not start TUI
      expect(mockStartRemoteTUIChat.startRemoteTUIChat).not.toHaveBeenCalled();

      // Should not make POST request
      expect(mockFetch).not.toHaveBeenCalled();

      // Should output JSON
      expect(mockConsoleLog).toHaveBeenCalledWith(
        JSON.stringify({
          status: "success",
          message: "Remote environment connection details",
          url: testUrl,
          mode: "direct_url",
        }),
      );
    });

    it("should create remote environment, output JSON, and exit without starting TUI when using --start", async () => {
      await remote("test prompt", { start: true });

      // Should make POST request to create environment
      expect(mockFetch).toHaveBeenCalledWith(
        new URL("agents", mockEnv.env.apiBase),
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
          },
        }),
      );

      // Should not start TUI
      expect(mockStartRemoteTUIChat.startRemoteTUIChat).not.toHaveBeenCalled();

      // Should output JSON with environment details
      const consoleLogCall = mockConsoleLog.mock.calls[0][0];
      const outputJson = JSON.parse(consoleLogCall);

      expect(outputJson).toEqual({
        status: "success",
        message: "Remote development environment created successfully",
        url: "https://test.example.com/agents/test-agent-id",
        containerUrl: "ws://test-url.com",
        containerPort: 8080,
        name: expect.stringMatching(/^devbox-\d+$/),
        mode: "new_environment",
      });
    });

    it("should work with start mode and idempotency key", async () => {
      const testIdempotencyKey = "start-mode-key";

      await remote("test prompt", {
        start: true,
        idempotencyKey: testIdempotencyKey,
      });

      // Should include idempotency key in request
      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.idempotencyKey).toBe(testIdempotencyKey);

      // Should not start TUI
      expect(mockStartRemoteTUIChat.startRemoteTUIChat).not.toHaveBeenCalled();

      // Should output JSON
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('"status":"success"'),
      );
    });
  });
});
