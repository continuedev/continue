import { beforeEach, describe, expect, it, vi } from "vitest";

<<<<<<< HEAD
import * as workosModule from "./auth/workos.js";
import { services } from "./services/index.js";
import * as sessionModule from "./session.js";
import { handleSlashCommands } from "./slashCommands.js";
import { posthogService } from "./telemetry/posthogService.js";
import * as versionModule from "./version.js";

// Mock all dependencies
vi.mock("./auth/workos.js");
=======
import { services } from "./services/index.js";
import * as sessionModule from "./session.js";
import { handleSlashCommands } from "./slashCommands.js";
import * as versionModule from "./version.js";

// Mock all dependencies
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
vi.mock("./version.js", () => ({
  getVersion: vi.fn(() => "1.2.3"),
  getLatestVersion: vi.fn(() => Promise.resolve(null)),
  compareVersions: vi.fn(() => "same"),
}));
vi.mock("./session.js");
<<<<<<< HEAD
vi.mock("./telemetry/posthogService.js");
=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))

vi.mock("./services/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./services/index.js")>();
  return {
    ...actual,
    services: {
      config: {
        getState: vi.fn(),
      },
      model: {
        getModelInfo: vi.fn(),
      },
    },
  };
});

describe("handleSlashCommands - /info", () => {
  const mockAssistant = {
    prompts: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock process.cwd
    vi.spyOn(process, "cwd").mockReturnValue("/test/working/directory");

<<<<<<< HEAD
    // Mock posthog
    vi.mocked(posthogService.capture).mockReturnValue(Promise.resolve());

=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
    // Mock version
    vi.mocked(versionModule.getVersion).mockReturnValue("1.2.3");

    // Mock session
    vi.mocked(sessionModule.getSessionFilePath).mockReturnValue(
      "/test/session.json",
    );
  });

  it("should include version and working directory in output", async () => {
<<<<<<< HEAD
    // Mock auth as not authenticated
    vi.mocked(workosModule.isAuthenticated).mockResolvedValue(false);

=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
    // Mock config service
    const mockConfigState = {
      config: { name: "test-config", version: "1.0.0" } as any,
      configPath: "/test/config.yaml",
    };
    vi.mocked(services.config.getState).mockReturnValue(mockConfigState);
    vi.mocked(services.model.getModelInfo).mockReturnValue({
      provider: "openai",
      name: "gpt-4",
    });

    const result = await handleSlashCommands("/info", mockAssistant as any);

    expect(result).toBeDefined();
    expect(result?.output).toContain("CLI Information:");
    expect(result?.output).toContain("Version: 1.2.3");
    expect(result?.output).toContain(
      "Working Directory: /test/working/directory",
    );
    expect(result?.output).toContain("Configuration:");
    expect(result?.output).toContain("Model: gpt-4");
    expect(result?.exit).toBe(false);
  });

<<<<<<< HEAD
  it("should handle authenticated user info", async () => {
    // Mock auth as authenticated
    vi.mocked(workosModule.isAuthenticated).mockResolvedValue(true);
    vi.mocked(workosModule.loadAuthConfig).mockReturnValue({
      userEmail: "test@example.com",
      userId: "test-user",
    } as any);
    vi.mocked(workosModule.isAuthenticatedConfig).mockReturnValue(true);

=======
  it("should show model info in configuration section", async () => {
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
    // Mock config service
    const mockConfigState = {
      config: { name: "test-config", version: "1.0.0" } as any,
      configPath: "/test/config.yaml",
    };
    vi.mocked(services.config.getState).mockReturnValue(mockConfigState);
    vi.mocked(services.model.getModelInfo).mockReturnValue({
      provider: "anthropic",
      name: "claude-3-sonnet",
    });

    const result = await handleSlashCommands("/info", mockAssistant as any);

<<<<<<< HEAD
    expect(result?.output).toContain("Authentication:");
    expect(result?.output).toContain("Email: test@example.com");
=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
    expect(result?.output).toContain("Model: claude-3-sonnet");
  });

  it("should handle missing model info gracefully", async () => {
<<<<<<< HEAD
    // Mock auth as not authenticated
    vi.mocked(workosModule.isAuthenticated).mockResolvedValue(false);

=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
    // Mock config service with no model info
    const mockConfigState = {
      config: { name: "test-config", version: "1.0.0" } as any,
      configPath: "/test/config.yaml",
    };
    vi.mocked(services.config.getState).mockReturnValue(mockConfigState);
    vi.mocked(services.model.getModelInfo).mockReturnValue(null);

    const result = await handleSlashCommands("/info", mockAssistant as any);

    expect(result?.output).toContain("Model: Not available");
  });

  it("should handle config service error", async () => {
<<<<<<< HEAD
    // Mock auth as not authenticated
    vi.mocked(workosModule.isAuthenticated).mockResolvedValue(false);

=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
    // Mock config service throwing error
    vi.mocked(services.config.getState).mockImplementation(() => {
      throw new Error("Service not available");
    });

    const result = await handleSlashCommands("/info", mockAssistant as any);

    expect(result?.output).toContain("Configuration service not available");
  });
});
