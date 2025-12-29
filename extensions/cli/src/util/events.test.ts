import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ApiRequestError, AuthenticationRequiredError } from "./apiClient.js";
import {
  getAgentIdFromArgs,
  postAgentEvent,
  type EmitEventParams,
} from "./events.js";

// Mock the dependencies
vi.mock("./apiClient.js", async () => {
  const actual = await vi.importActual("./apiClient.js");
  return {
    ...actual,
    post: vi.fn(),
  };
});

vi.mock("./logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("events", () => {
  let mockPost: any;
  let originalArgv: string[];

  beforeEach(async () => {
    vi.clearAllMocks();

    // Save original argv
    originalArgv = process.argv;

    // Get mocked functions
    const apiClientModule = await import("./apiClient.js");
    mockPost = vi.mocked(apiClientModule.post);
  });

  afterEach(() => {
    // Restore original argv
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  describe("getAgentIdFromArgs", () => {
    test("should extract agent ID from --id flag", () => {
      process.argv = ["node", "script.js", "--id", "test-agent-123", "serve"];

      const agentId = getAgentIdFromArgs();

      expect(agentId).toBe("test-agent-123");
    });

    test("should handle --id flag at end of arguments", () => {
      process.argv = ["node", "script.js", "serve", "--id", "agent-456"];

      const agentId = getAgentIdFromArgs();

      expect(agentId).toBe("agent-456");
    });

    test("should return undefined when no --id flag present", () => {
      process.argv = ["node", "script.js", "serve"];

      const agentId = getAgentIdFromArgs();

      expect(agentId).toBeUndefined();
    });

    test("should return undefined when --id flag has no value", () => {
      process.argv = ["node", "script.js", "--id"];

      const agentId = getAgentIdFromArgs();

      expect(agentId).toBeUndefined();
    });

    test("should handle multiple flags and extract correct ID", () => {
      process.argv = [
        "node",
        "script.js",
        "--verbose",
        "--id",
        "complex-agent-789",
        "--port",
        "3000",
      ];

      const agentId = getAgentIdFromArgs();

      expect(agentId).toBe("complex-agent-789");
    });

    test("should handle agent IDs with special characters", () => {
      process.argv = [
        "node",
        "script.js",
        "--id",
        "agent_with-special.chars123",
      ];

      const agentId = getAgentIdFromArgs();

      expect(agentId).toBe("agent_with-special.chars123");
    });
  });

  describe("postAgentEvent", () => {
    test("should successfully post event to control plane", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        data: { id: "event-123", eventName: "pr_created" },
      };
      mockPost.mockResolvedValue(mockResponse);

      const params: EmitEventParams = {
        eventName: "pr_created",
        title: "Created PR #123",
        description: "Fixed authentication bug",
        externalUrl: "https://github.com/org/repo/pull/123",
      };

      const result = await postAgentEvent("agent-id-123", params);

      expect(mockPost).toHaveBeenCalledWith("agents/agent-id-123/events", {
        eventName: "pr_created",
        title: "Created PR #123",
        description: "Fixed authentication bug",
        metadata: undefined,
        externalUrl: "https://github.com/org/repo/pull/123",
      });

      expect(result).toEqual({ id: "event-123", eventName: "pr_created" });
    });

    test("should handle minimal event params (only required fields)", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        data: { id: "event-456" },
      };
      mockPost.mockResolvedValue(mockResponse);

      const params: EmitEventParams = {
        eventName: "commit_pushed",
        title: "Pushed 3 commits",
      };

      const result = await postAgentEvent("agent-id-456", params);

      expect(mockPost).toHaveBeenCalledWith("agents/agent-id-456/events", {
        eventName: "commit_pushed",
        title: "Pushed 3 commits",
        description: undefined,
        metadata: undefined,
        externalUrl: undefined,
      });

      expect(result).toBeDefined();
    });

    test("should handle event with metadata", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        data: { id: "event-789" },
      };
      mockPost.mockResolvedValue(mockResponse);

      const params: EmitEventParams = {
        eventName: "custom_event",
        title: "Custom action completed",
        metadata: {
          duration: 1500,
          filesModified: 5,
          linesChanged: 150,
        },
      };

      const result = await postAgentEvent("agent-id-789", params);

      expect(mockPost).toHaveBeenCalledWith("agents/agent-id-789/events", {
        eventName: "custom_event",
        title: "Custom action completed",
        description: undefined,
        metadata: {
          duration: 1500,
          filesModified: 5,
          linesChanged: 150,
        },
        externalUrl: undefined,
      });

      expect(result).toBeDefined();
    });

    test("should return undefined when agent ID is empty string", async () => {
      const params: EmitEventParams = {
        eventName: "pr_created",
        title: "Test",
      };

      const result = await postAgentEvent("", params);

      expect(mockPost).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    test("should return undefined when eventName is missing", async () => {
      const params = {
        eventName: "",
        title: "Test title",
      } as EmitEventParams;

      const result = await postAgentEvent("agent-id-123", params);

      expect(mockPost).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    test("should return undefined when title is missing", async () => {
      const params = {
        eventName: "pr_created",
        title: "",
      } as EmitEventParams;

      const result = await postAgentEvent("agent-id-123", params);

      expect(mockPost).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    test("should handle non-ok response from API", async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        data: null,
      };
      mockPost.mockResolvedValue(mockResponse);

      const params: EmitEventParams = {
        eventName: "pr_created",
        title: "Test",
      };

      const result = await postAgentEvent("agent-id-123", params);

      expect(result).toBeUndefined();
    });

    test("should handle AuthenticationRequiredError gracefully", async () => {
      mockPost.mockRejectedValue(
        new AuthenticationRequiredError(
          "Not authenticated. Please run 'cn login' first.",
        ),
      );

      const params: EmitEventParams = {
        eventName: "pr_created",
        title: "Test",
      };

      const result = await postAgentEvent("agent-id-123", params);

      expect(result).toBeUndefined();
    });

    test("should handle ApiRequestError gracefully", async () => {
      mockPost.mockRejectedValue(
        new ApiRequestError(500, "Internal Server Error", "Server error"),
      );

      const params: EmitEventParams = {
        eventName: "pr_created",
        title: "Test",
      };

      const result = await postAgentEvent("agent-id-123", params);

      expect(result).toBeUndefined();
    });

    test("should handle generic network errors gracefully", async () => {
      mockPost.mockRejectedValue(new Error("Network connection failed"));

      const params: EmitEventParams = {
        eventName: "pr_created",
        title: "Test",
      };

      const result = await postAgentEvent("agent-id-123", params);

      expect(result).toBeUndefined();
    });

    test("should handle all standard event types", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        data: { id: "event-standard" },
      };
      mockPost.mockResolvedValue(mockResponse);

      const standardEvents = [
        "comment_posted",
        "pr_created",
        "commit_pushed",
        "issue_closed",
        "review_submitted",
      ];

      for (const eventName of standardEvents) {
        const params: EmitEventParams = {
          eventName,
          title: `Test ${eventName}`,
        };

        const result = await postAgentEvent("agent-id", params);

        expect(result).toBeDefined();
        expect(mockPost).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ eventName }),
        );
      }

      expect(mockPost).toHaveBeenCalledTimes(standardEvents.length);
    });

    test("should handle custom event names", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        data: { id: "event-custom" },
      };
      mockPost.mockResolvedValue(mockResponse);

      const params: EmitEventParams = {
        eventName: "custom_deployment_completed",
        title: "Deployed to production",
      };

      const result = await postAgentEvent("agent-id", params);

      expect(result).toBeDefined();
      expect(mockPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ eventName: "custom_deployment_completed" }),
      );
    });

    test("should handle URLs with special characters", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        data: { id: "event-url" },
      };
      mockPost.mockResolvedValue(mockResponse);

      const params: EmitEventParams = {
        eventName: "pr_created",
        title: "Test",
        externalUrl:
          "https://github.com/org/repo/pull/123#issuecomment-456789?tab=files",
      };

      const result = await postAgentEvent("agent-id", params);

      expect(result).toBeDefined();
      expect(mockPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          externalUrl:
            "https://github.com/org/repo/pull/123#issuecomment-456789?tab=files",
        }),
      );
    });

    test("should handle very long descriptions", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        data: { id: "event-long" },
      };
      mockPost.mockResolvedValue(mockResponse);

      const longDescription = "A".repeat(10000);
      const params: EmitEventParams = {
        eventName: "pr_created",
        title: "Test",
        description: longDescription,
      };

      const result = await postAgentEvent("agent-id", params);

      expect(result).toBeDefined();
      expect(mockPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ description: longDescription }),
      );
    });

    test("should handle concurrent event posting", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        data: { id: "event-concurrent" },
      };
      mockPost.mockResolvedValue(mockResponse);

      const promises = Array.from({ length: 10 }, (_, i) =>
        postAgentEvent("agent-id", {
          eventName: "test_event",
          title: `Event ${i}`,
        }),
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(results.every((r) => r !== undefined)).toBe(true);
      expect(mockPost).toHaveBeenCalledTimes(10);
    });

    test("should preserve metadata types", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        data: { id: "event-metadata" },
      };
      mockPost.mockResolvedValue(mockResponse);

      const params: EmitEventParams = {
        eventName: "test_event",
        title: "Test",
        metadata: {
          stringValue: "test",
          numberValue: 42,
          booleanValue: true,
          nullValue: null,
          arrayValue: [1, 2, 3],
          objectValue: { nested: "value" },
        },
      };

      const result = await postAgentEvent("agent-id", params);

      expect(result).toBeDefined();
      expect(mockPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          metadata: {
            stringValue: "test",
            numberValue: 42,
            booleanValue: true,
            nullValue: null,
            arrayValue: [1, 2, 3],
            objectValue: { nested: "value" },
          },
        }),
      );
    });
  });
});
