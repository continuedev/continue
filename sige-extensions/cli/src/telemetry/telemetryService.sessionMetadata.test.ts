import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { telemetryService } from "./telemetryService.js";

describe("TelemetryService - Session Metadata", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalArgv: string[];

  beforeEach(() => {
    // Save original environment and argv
    originalEnv = { ...process.env };
    originalArgv = [...process.argv];

    // Mock logger to prevent console output during tests
    vi.mock("../util/logger.js", () => ({
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    }));

    // Enable telemetry for tests
    process.env.CONTINUE_CLI_ENABLE_TELEMETRY = "1";
    process.env.OTEL_METRICS_EXPORTER = "console";
  });

  afterEach(() => {
    // Restore original environment and argv
    process.env = originalEnv;
    process.argv = originalArgv;
    vi.clearAllMocks();
  });

  describe("recordSessionStart", () => {
    it("should include is_headless=false when not in headless mode", () => {
      // Set up non-headless mode (no -p or --print flags)
      process.argv = ["node", "cli.js", "chat"];

      const mockAdd = vi.fn();
      const mockRecord = vi.fn();
      const service = telemetryService as any;

      // Mock the session counter and startup time histogram
      service.sessionCounter = { add: mockAdd };
      service.startupTimeHistogram = { record: mockRecord };
      service.config = { enabled: true };
      service.meter = {};

      service.recordSessionStart();

      expect(mockAdd).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          is_headless: "false",
        }),
      );
    });

    it("should include is_headless=true when -p flag is present", () => {
      // Set up headless mode with -p flag
      process.argv = ["node", "cli.js", "-p", "What is the weather?"];

      const mockAdd = vi.fn();
      const mockRecord = vi.fn();
      const service = telemetryService as any;

      // Mock the session counter and startup time histogram
      service.sessionCounter = { add: mockAdd };
      service.startupTimeHistogram = { record: mockRecord };
      service.config = { enabled: true };
      service.meter = {};

      service.recordSessionStart();

      expect(mockAdd).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          is_headless: "true",
        }),
      );
    });

    it("should include is_headless=true when --print flag is present", () => {
      // Set up headless mode with --print flag
      process.argv = ["node", "cli.js", "--print", "What is the weather?"];

      const mockAdd = vi.fn();
      const mockRecord = vi.fn();
      const service = telemetryService as any;

      // Mock the session counter and startup time histogram
      service.sessionCounter = { add: mockAdd };
      service.startupTimeHistogram = { record: mockRecord };
      service.config = { enabled: true };
      service.meter = {};

      service.recordSessionStart();

      expect(mockAdd).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          is_headless: "true",
        }),
      );
    });

    it("should include is_github_actions=false when not in GitHub Actions", () => {
      // Ensure GITHUB_ACTIONS is not set
      delete process.env.GITHUB_ACTIONS;

      const mockAdd = vi.fn();
      const mockRecord = vi.fn();
      const service = telemetryService as any;

      // Mock the session counter and startup time histogram
      service.sessionCounter = { add: mockAdd };
      service.startupTimeHistogram = { record: mockRecord };
      service.config = { enabled: true };
      service.meter = {};

      service.recordSessionStart();

      expect(mockAdd).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          is_github_actions: "false",
          is_continue_remote_agent: "false",
        }),
      );
    });

    it("should include is_github_actions=true when in GitHub Actions", () => {
      // Set GitHub Actions environment
      process.env.GITHUB_ACTIONS = "true";

      const mockAdd = vi.fn();
      const mockRecord = vi.fn();
      const service = telemetryService as any;

      // Mock the session counter and startup time histogram
      service.sessionCounter = { add: mockAdd };
      service.startupTimeHistogram = { record: mockRecord };
      service.config = { enabled: true };
      service.meter = {};

      service.recordSessionStart();

      expect(mockAdd).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          is_github_actions: "true",
          is_continue_remote_agent: "false",
        }),
      );
    });

    it("should include both headless and GitHub Actions metadata when both are true", () => {
      // Set both headless mode and GitHub Actions
      process.argv = ["node", "cli.js", "-p", "What is the weather?"];
      process.env.GITHUB_ACTIONS = "true";

      const mockAdd = vi.fn();
      const mockRecord = vi.fn();
      const service = telemetryService as any;

      // Mock the session counter and startup time histogram
      service.sessionCounter = { add: mockAdd };
      service.startupTimeHistogram = { record: mockRecord };
      service.config = { enabled: true };
      service.meter = {};

      service.recordSessionStart();

      expect(mockAdd).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          is_headless: "true",
          is_github_actions: "true",
          is_continue_remote_agent: "false",
        }),
      );
    });

    it("should include is_continue_remote_agent=true when in remote agent mode", () => {
      // Set Continue remote agent environment
      process.env.CONTINUE_REMOTE = "true";

      const mockAdd = vi.fn();
      const mockRecord = vi.fn();
      const service = telemetryService as any;

      // Mock the session counter and startup time histogram
      service.sessionCounter = { add: mockAdd };
      service.startupTimeHistogram = { record: mockRecord };
      service.config = { enabled: true };
      service.meter = {};

      service.recordSessionStart();

      expect(mockAdd).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          is_continue_remote_agent: "true",
        }),
      );
    });

    it("should include all environment flags when all are true", () => {
      // Set all environments
      process.argv = ["node", "cli.js", "-p", "What is the weather?"];
      process.env.GITHUB_ACTIONS = "true";
      process.env.CONTINUE_REMOTE = "true";

      const mockAdd = vi.fn();
      const mockRecord = vi.fn();
      const service = telemetryService as any;

      // Mock the session counter and startup time histogram
      service.sessionCounter = { add: mockAdd };
      service.startupTimeHistogram = { record: mockRecord };
      service.config = { enabled: true };
      service.meter = {};

      service.recordSessionStart();

      expect(mockAdd).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          is_headless: "true",
          is_github_actions: "true",
          is_continue_remote_agent: "true",
        }),
      );
    });
  });
});
