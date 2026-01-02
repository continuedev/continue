import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Mock core dependencies before importing
vi.mock("core/util/errors.js", () => ({
  ContinueError: class ContinueError extends Error {
    constructor(
      public reason: string,
      message: string,
    ) {
      super(message);
      this.name = "ContinueError";
    }
  },
  ContinueErrorReason: {
    Unspecified: "Unspecified",
  },
}));

import {
  ApiRequestError,
  AuthenticationRequiredError,
} from "../util/apiClient.js";

import { eventTool } from "./event.js";

// Mock the dependencies
vi.mock("../util/events.js", () => ({
  getAgentIdFromArgs: vi.fn(),
  postAgentEvent: vi.fn(),
}));

vi.mock("../util/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("eventTool", () => {
  let mockGetAgentIdFromArgs: any;
  let mockPostAgentEvent: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get mocked functions
    const eventsModule = await import("../util/events.js");
    mockGetAgentIdFromArgs = vi.mocked(eventsModule.getAgentIdFromArgs);
    mockPostAgentEvent = vi.mocked(eventsModule.postAgentEvent);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("tool metadata", () => {
    test("should have correct basic properties", () => {
      expect(eventTool.name).toBe("Event");
      expect(eventTool.displayName).toBe("Event");
      expect(eventTool.readonly).toBe(true);
      expect(eventTool.isBuiltIn).toBe(true);
    });

    test("should have comprehensive description", () => {
      expect(eventTool.description).toContain("activity event");
      expect(eventTool.description).toContain("task timeline");
      expect(eventTool.description).toContain("pull request");
      expect(eventTool.description).toContain("eventName");
      expect(eventTool.description).toContain("title");
      expect(eventTool.description).toContain("description");
      expect(eventTool.description).toContain("externalUrl");
    });

    test("should have correct parameter schema", () => {
      expect(eventTool.parameters.type).toBe("object");
      expect(eventTool.parameters.required).toEqual(["eventName", "title"]);

      const props = eventTool.parameters.properties;
      expect(props.eventName).toBeDefined();
      expect(props.eventName.type).toBe("string");
      expect(props.title).toBeDefined();
      expect(props.title.type).toBe("string");
      expect(props.description).toBeDefined();
      expect(props.description.type).toBe("string");
      expect(props.externalUrl).toBeDefined();
      expect(props.externalUrl.type).toBe("string");
    });

    test("should have descriptions for all parameters", () => {
      const props = eventTool.parameters.properties;
      expect(props.eventName.description).toBeTruthy();
      expect(props.title.description).toBeTruthy();
      expect(props.description.description).toBeTruthy();
      expect(props.externalUrl.description).toBeTruthy();
    });
  });

  describe("run method - success scenarios", () => {
    test("should successfully record event with all parameters", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("agent-123");
      mockPostAgentEvent.mockResolvedValue({ id: "event-123" });

      const result = await eventTool.run({
        eventName: "pr_created",
        title: "Created PR #456",
        description: "Fixed authentication bug",
        externalUrl: "https://github.com/org/repo/pull/456",
      });

      expect(mockGetAgentIdFromArgs).toHaveBeenCalled();
      expect(mockPostAgentEvent).toHaveBeenCalledWith("agent-123", {
        eventName: "pr_created",
        title: "Created PR #456",
        description: "Fixed authentication bug",
        externalUrl: "https://github.com/org/repo/pull/456",
      });
      expect(result).toBe("Event recorded: Created PR #456");
    });

    test("should successfully record event with minimal parameters", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("agent-456");
      mockPostAgentEvent.mockResolvedValue({ id: "event-456" });

      const result = await eventTool.run({
        eventName: "commit_pushed",
        title: "Pushed 5 commits",
      });

      expect(mockPostAgentEvent).toHaveBeenCalledWith("agent-456", {
        eventName: "commit_pushed",
        title: "Pushed 5 commits",
        description: undefined,
        externalUrl: undefined,
      });
      expect(result).toBe("Event recorded: Pushed 5 commits");
    });

    test("should handle all standard event types", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("agent-std");
      mockPostAgentEvent.mockResolvedValue({ id: "event-std" });

      const standardEvents = [
        "comment_posted",
        "pr_created",
        "commit_pushed",
        "issue_closed",
        "review_submitted",
      ];

      for (const eventName of standardEvents) {
        const result = await eventTool.run({
          eventName,
          title: `Test ${eventName}`,
        });

        expect(result).toContain("Event recorded");
        expect(mockPostAgentEvent).toHaveBeenCalledWith(
          "agent-std",
          expect.objectContaining({ eventName }),
        );
      }
    });

    test("should handle custom event names", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("agent-custom");
      mockPostAgentEvent.mockResolvedValue({ id: "event-custom" });

      const result = await eventTool.run({
        eventName: "custom_deployment",
        title: "Deployed to production",
      });

      expect(result).toBe("Event recorded: Deployed to production");
      expect(mockPostAgentEvent).toHaveBeenCalledWith(
        "agent-custom",
        expect.objectContaining({ eventName: "custom_deployment" }),
      );
    });

    test("should handle event with only description", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("agent-desc");
      mockPostAgentEvent.mockResolvedValue({ id: "event-desc" });

      const result = await eventTool.run({
        eventName: "pr_created",
        title: "Created PR",
        description: "This is a very detailed description of the changes made",
      });

      expect(result).toBe("Event recorded: Created PR");
    });

    test("should handle event with only externalUrl", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("agent-url");
      mockPostAgentEvent.mockResolvedValue({ id: "event-url" });

      const result = await eventTool.run({
        eventName: "pr_created",
        title: "Created PR",
        externalUrl: "https://github.com/org/repo/pull/789",
      });

      expect(result).toBe("Event recorded: Created PR");
    });

    test("should handle failed event posting gracefully", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("agent-fail");
      mockPostAgentEvent.mockResolvedValue(undefined);

      const result = await eventTool.run({
        eventName: "pr_created",
        title: "Test PR",
      });

      expect(result).toBe(
        "Event acknowledged (but may not have been recorded): Test PR",
      );
    });

    test("should handle null/undefined return from postAgentEvent", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("agent-null");
      mockPostAgentEvent.mockResolvedValue(null);

      const result = await eventTool.run({
        eventName: "pr_created",
        title: "Test PR",
      });

      expect(result).toContain("but may not have been recorded");
    });
  });

  describe("run method - error scenarios", () => {
    test("should throw error when agent ID is missing", async () => {
      mockGetAgentIdFromArgs.mockReturnValue(undefined);

      await expect(
        eventTool.run({
          eventName: "pr_created",
          title: "Test",
        }),
      ).rejects.toThrow(Error);

      expect(mockPostAgentEvent).not.toHaveBeenCalled();
    });

    test("should throw error when agent ID is null", async () => {
      mockGetAgentIdFromArgs.mockReturnValue(null);

      await expect(
        eventTool.run({
          eventName: "pr_created",
          title: "Test",
        }),
      ).rejects.toThrow(Error);
    });

    test("should throw error when agent ID is empty string", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("");

      await expect(
        eventTool.run({
          eventName: "pr_created",
          title: "Test",
        }),
      ).rejects.toThrow(Error);
    });

    test("should handle AuthenticationRequiredError", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("agent-auth");
      mockPostAgentEvent.mockRejectedValue(
        new AuthenticationRequiredError(
          "Not authenticated. Please run 'cn login' first.",
        ),
      );

      await expect(
        eventTool.run({
          eventName: "pr_created",
          title: "Test",
        }),
      ).rejects.toThrow("Error: Authentication required");
    });

    test("should handle ApiRequestError with response", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("agent-api");
      mockPostAgentEvent.mockRejectedValue(
        new ApiRequestError(
          404,
          "Not Found",
          "Agent session not found or expired",
        ),
      );

      await expect(
        eventTool.run({
          eventName: "pr_created",
          title: "Test",
        }),
      ).rejects.toThrow(
        "Error recording event: 404 Agent session not found or expired",
      );
    });

    test("should handle ApiRequestError without response", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("agent-api-2");
      mockPostAgentEvent.mockRejectedValue(
        new ApiRequestError(500, "Internal Server Error"),
      );

      await expect(
        eventTool.run({
          eventName: "pr_created",
          title: "Test",
        }),
      ).rejects.toThrow("Error recording event: 500 Internal Server Error");
    });

    test("should handle generic Error", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("agent-generic");
      mockPostAgentEvent.mockRejectedValue(
        new Error("Network connection failed"),
      );

      await expect(
        eventTool.run({
          eventName: "pr_created",
          title: "Test",
        }),
      ).rejects.toThrow("Error recording event: Network connection failed");
    });

    test("should handle non-Error exceptions", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("agent-non-error");
      mockPostAgentEvent.mockRejectedValue("String error message");

      await expect(
        eventTool.run({
          eventName: "pr_created",
          title: "Test",
        }),
      ).rejects.toThrow("Error recording event: String error message");
    });

    test("should re-throw ContinueError as-is", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("agent-continue");
      const { ContinueError, ContinueErrorReason } = await import(
        "core/util/errors.js"
      );
      const continueError = new ContinueError(
        ContinueErrorReason.Unspecified,
        "Continue specific error",
      );
      mockPostAgentEvent.mockRejectedValue(continueError);

      await expect(
        eventTool.run({
          eventName: "pr_created",
          title: "Test",
        }),
      ).rejects.toThrow(continueError);
    });

    test("should handle timeout errors", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("agent-timeout");
      mockPostAgentEvent.mockRejectedValue(new Error("Request timeout"));

      await expect(
        eventTool.run({
          eventName: "pr_created",
          title: "Test",
        }),
      ).rejects.toThrow("Error recording event: Request timeout");
    });
  });

  describe("run method - edge cases", () => {
    test("should handle very long event names", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("agent-long");
      mockPostAgentEvent.mockResolvedValue({ id: "event-long" });

      const longEventName = "very_long_custom_event_name_".repeat(10);
      const result = await eventTool.run({
        eventName: longEventName,
        title: "Test",
      });

      expect(result).toContain("Event recorded");
      expect(mockPostAgentEvent).toHaveBeenCalledWith(
        "agent-long",
        expect.objectContaining({ eventName: longEventName }),
      );
    });

    test("should handle very long titles", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("agent-title");
      mockPostAgentEvent.mockResolvedValue({ id: "event-title" });

      const longTitle = "A".repeat(1000);
      const result = await eventTool.run({
        eventName: "pr_created",
        title: longTitle,
      });

      expect(result).toContain("Event recorded");
    });

    test("should handle special characters in event parameters", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("agent-special");
      mockPostAgentEvent.mockResolvedValue({ id: "event-special" });

      const result = await eventTool.run({
        eventName: "pr_created",
        title: 'PR #123: Fix "quotes" & special chars <>/\\',
        description: "Description with\nnewlines\tand\ttabs",
        externalUrl: "https://example.com/path?query=value&other=123#anchor",
      });

      expect(result).toContain("Event recorded");
    });

    test("should handle unicode characters", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("agent-unicode");
      mockPostAgentEvent.mockResolvedValue({ id: "event-unicode" });

      const result = await eventTool.run({
        eventName: "pr_created",
        title: "Created PR 🎉: Fix bug 🐛",
        description: "Description with emoji 👍 and unicode 你好",
      });

      expect(result).toContain("Event recorded");
    });

    test("should handle empty optional parameters", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("agent-empty");
      mockPostAgentEvent.mockResolvedValue({ id: "event-empty" });

      const result = await eventTool.run({
        eventName: "pr_created",
        title: "Test",
        description: "",
        externalUrl: "",
      });

      expect(result).toContain("Event recorded");
      expect(mockPostAgentEvent).toHaveBeenCalledWith(
        "agent-empty",
        expect.objectContaining({
          description: "",
          externalUrl: "",
        }),
      );
    });

    test("should handle whitespace-only parameters", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("agent-whitespace");
      mockPostAgentEvent.mockResolvedValue({ id: "event-whitespace" });

      const result = await eventTool.run({
        eventName: "   pr_created   ",
        title: "   Test Title   ",
        description: "   ",
        externalUrl: "   ",
      });

      expect(result).toContain("Event recorded");
    });

    test("should handle consecutive event calls", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("agent-consecutive");
      mockPostAgentEvent.mockResolvedValue({ id: "event-1" });

      const result1 = await eventTool.run({
        eventName: "pr_created",
        title: "First event",
      });

      mockPostAgentEvent.mockResolvedValue({ id: "event-2" });

      const result2 = await eventTool.run({
        eventName: "commit_pushed",
        title: "Second event",
      });

      expect(result1).toContain("First event");
      expect(result2).toContain("Second event");
      expect(mockPostAgentEvent).toHaveBeenCalledTimes(2);
    });

    test("should handle concurrent event calls", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("agent-concurrent");
      mockPostAgentEvent.mockResolvedValue({ id: "event-concurrent" });

      const promises = [
        eventTool.run({ eventName: "event1", title: "Event 1" }),
        eventTool.run({ eventName: "event2", title: "Event 2" }),
        eventTool.run({ eventName: "event3", title: "Event 3" }),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.includes("Event recorded"))).toBe(true);
      expect(mockPostAgentEvent).toHaveBeenCalledTimes(3);
    });

    test("should handle malformed URLs in externalUrl", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("agent-malformed");
      mockPostAgentEvent.mockResolvedValue({ id: "event-malformed" });

      const result = await eventTool.run({
        eventName: "pr_created",
        title: "Test",
        externalUrl: "not-a-valid-url",
      });

      expect(result).toContain("Event recorded");
      expect(mockPostAgentEvent).toHaveBeenCalledWith(
        "agent-malformed",
        expect.objectContaining({ externalUrl: "not-a-valid-url" }),
      );
    });
  });

  describe("run method - integration scenarios", () => {
    test("should simulate complete PR creation flow", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("agent-pr-flow");
      mockPostAgentEvent.mockResolvedValue({ id: "event-pr-flow" });

      const result = await eventTool.run({
        eventName: "pr_created",
        title: "Created PR #789: Implement new feature",
        description:
          "Added new authentication feature with OAuth2 support. Includes tests and documentation.",
        externalUrl: "https://github.com/continuedev/continue/pull/789",
      });

      expect(result).toBe(
        "Event recorded: Created PR #789: Implement new feature",
      );
      expect(mockPostAgentEvent).toHaveBeenCalledWith("agent-pr-flow", {
        eventName: "pr_created",
        title: "Created PR #789: Implement new feature",
        description:
          "Added new authentication feature with OAuth2 support. Includes tests and documentation.",
        externalUrl: "https://github.com/continuedev/continue/pull/789",
      });
    });

    test("should simulate comment posting flow", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("agent-comment");
      mockPostAgentEvent.mockResolvedValue({ id: "event-comment" });

      const result = await eventTool.run({
        eventName: "comment_posted",
        title: "Posted review comment on PR #456",
        description: "Suggested improvements to error handling logic",
        externalUrl:
          "https://github.com/continuedev/continue/pull/456#issuecomment-123456789",
      });

      expect(result).toContain("Event recorded");
    });

    test("should simulate commit push flow", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("agent-commit");
      mockPostAgentEvent.mockResolvedValue({ id: "event-commit" });

      const result = await eventTool.run({
        eventName: "commit_pushed",
        title: "Pushed 3 commits to feature/new-auth",
        description: "Commits: abc123f, def456a, ghi789b",
      });

      expect(result).toContain("Event recorded");
    });

    test("should simulate issue closure flow", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("agent-issue");
      mockPostAgentEvent.mockResolvedValue({ id: "event-issue" });

      const result = await eventTool.run({
        eventName: "issue_closed",
        title: "Closed issue #123: Fix authentication bug",
        externalUrl: "https://github.com/continuedev/continue/issues/123",
      });

      expect(result).toContain("Event recorded");
    });

    test("should simulate review submission flow", async () => {
      mockGetAgentIdFromArgs.mockReturnValue("agent-review");
      mockPostAgentEvent.mockResolvedValue({ id: "event-review" });

      const result = await eventTool.run({
        eventName: "review_submitted",
        title: "Submitted code review for PR #789",
        description: "Approved with minor suggestions",
        externalUrl:
          "https://github.com/continuedev/continue/pull/789#pullrequestreview-987654321",
      });

      expect(result).toContain("Event recorded");
    });
  });
});
