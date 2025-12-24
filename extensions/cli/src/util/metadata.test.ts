import type { ChatHistoryItem } from "core/index.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  calculateDiffStats,
  extractSummary,
  getAgentIdFromArgs,
  postAgentMetadata,
} from "./metadata.js";

// Mock dependencies
vi.mock("./apiClient.js", () => ({
  post: vi.fn(),
  ApiRequestError: class ApiRequestError extends Error {
    status: number;
    statusText: string;
    response?: string;
    constructor(status: number, statusText: string, response?: string) {
      super(
        `API Error: ${status} ${statusText}${response ? `: ${response}` : ""}`,
      );
      this.name = "ApiRequestError";
      this.status = status;
      this.statusText = statusText;
      this.response = response;
    }
  },
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {
    constructor(message = "Not authenticated. Please run 'cn login' first.") {
      super(message);
      this.name = "AuthenticationRequiredError";
    }
  },
}));

vi.mock("./logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Helper to create a mock chat history item
function createMockChatHistoryItem(
  content: string,
  role: "user" | "assistant" | "system" = "assistant",
): ChatHistoryItem {
  return {
    message: {
      role,
      content,
    },
  } as ChatHistoryItem;
}

describe("metadata utilities", () => {
  describe("calculateDiffStats", () => {
    it("should count additions and deletions in a simple diff", () => {
      const diff = `diff --git a/file.txt b/file.txt
index 123..456 789
--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,3 @@
 line 1
-line 2
+line 2 modified
 line 3`;

      const stats = calculateDiffStats(diff);

      expect(stats.additions).toBe(1);
      expect(stats.deletions).toBe(1);
    });

    it("should handle multiple hunks with multiple changes", () => {
      const diff = `diff --git a/app.js b/app.js
--- a/app.js
+++ b/app.js
@@ -10,5 +10,7 @@
 const express = require('express');
-const old = 'value';
+const new = 'value';
+const another = 'line';

@@ -50,3 +52,2 @@
-function oldFunc() {}
-function anotherOld() {}
+function newFunc() {}`;

      const stats = calculateDiffStats(diff);

      expect(stats.additions).toBe(3); // +const new, +const another, +function newFunc
      expect(stats.deletions).toBe(3); // -const old, -function oldFunc, -function anotherOld
    });

    it("should exclude diff metadata lines from counts", () => {
      const diff = `diff --git a/file.txt b/file.txt
index abc123..def456 100644
--- a/file.txt
+++ b/file.txt
@@ -1 +1 @@
-old content
+new content`;

      const stats = calculateDiffStats(diff);

      // Should only count the actual changes, not the metadata lines
      expect(stats.additions).toBe(1);
      expect(stats.deletions).toBe(1);
    });

    it("should handle binary file changes", () => {
      const diff = `diff --git a/image.png b/image.png
Binary files a/image.png and b/image.png differ`;

      const stats = calculateDiffStats(diff);

      // Binary files shouldn't be counted
      expect(stats.additions).toBe(0);
      expect(stats.deletions).toBe(0);
    });

    it("should return zeros for empty diff", () => {
      const stats = calculateDiffStats("");

      expect(stats.additions).toBe(0);
      expect(stats.deletions).toBe(0);
    });

    it("should return zeros for whitespace-only diff", () => {
      const stats = calculateDiffStats("   \n\n   \t  ");

      expect(stats.additions).toBe(0);
      expect(stats.deletions).toBe(0);
    });

    it("should handle a diff with only additions", () => {
      const diff = `diff --git a/new.txt b/new.txt
--- /dev/null
+++ b/new.txt
@@ -0,0 +1,3 @@
+line 1
+line 2
+line 3`;

      const stats = calculateDiffStats(diff);

      expect(stats.additions).toBe(3);
      expect(stats.deletions).toBe(0);
    });

    it("should handle a diff with only deletions", () => {
      const diff = `diff --git a/old.txt b/old.txt
--- a/old.txt
+++ /dev/null
@@ -1,3 +0,0 @@
-line 1
-line 2
-line 3`;

      const stats = calculateDiffStats(diff);

      expect(stats.additions).toBe(0);
      expect(stats.deletions).toBe(3);
    });

    it("should handle real-world TypeScript diff", () => {
      const diff = `diff --git a/src/util/metadata.ts b/src/util/metadata.ts
index abc123..def456 100644
--- a/src/util/metadata.ts
+++ b/src/util/metadata.ts
@@ -1,10 +1,15 @@
 import type { ChatHistoryItem } from "core/index.js";

-export function oldFunction() {
-  return "old";
+export function newFunction() {
+  return "new";
+}
+
+export function anotherFunction() {
+  return "another";
 }

 // Comment line (unchanged)
-const OLD_CONSTANT = 42;
+const NEW_CONSTANT = 43;`;

      const stats = calculateDiffStats(diff);

      expect(stats.additions).toBe(7);
      expect(stats.deletions).toBe(3);
    });

    it("should correctly count code with ++ or -- operators", () => {
      // This tests the edge case where code contains ++ or -- at the start
      const diff = `diff --git a/counter.js b/counter.js
index abc123..def456 100644
--- a/counter.js
+++ b/counter.js
@@ -1,5 +1,5 @@
 function increment(counter) {
-  counter++;
+  ++counter;
 }

 function decrement(counter) {
-  counter--;
+  --counter;
 }`;

      const stats = calculateDiffStats(diff);

      // Should count all 4 changes: 2 additions and 2 deletions
      // Lines like "+++counter;" should be counted as additions, not skipped as file headers
      expect(stats.additions).toBe(2);
      expect(stats.deletions).toBe(2);
    });

    it("should handle code with multiple + or - at line start", () => {
      const diff = `diff --git a/operators.c b/operators.c
--- a/operators.c
+++ b/operators.c
@@ -1,4 +1,4 @@
 int main() {
-  x--;
-  y++;
+  --x;
+  ++y;
   return 0;
 }`;

      const stats = calculateDiffStats(diff);

      expect(stats.additions).toBe(2);
      expect(stats.deletions).toBe(2);
    });
  });

  describe("extractSummary", () => {
    it("should extract last assistant message", () => {
      const history = [
        createMockChatHistoryItem("Hello", "user"),
        createMockChatHistoryItem("Hi there, how can I help?", "assistant"),
        createMockChatHistoryItem("Please fix the bug", "user"),
        createMockChatHistoryItem(
          "I've fixed the authentication bug in the login module.",
          "assistant",
        ),
      ];

      const summary = extractSummary(history);

      expect(summary).toBe(
        "I've fixed the authentication bug in the login module.",
      );
    });

    it("should skip empty assistant messages", () => {
      const history = [
        createMockChatHistoryItem("User message", "user"),
        createMockChatHistoryItem("Valid assistant message", "assistant"),
        createMockChatHistoryItem("", "assistant"),
        createMockChatHistoryItem("   ", "assistant"),
      ];

      const summary = extractSummary(history);

      expect(summary).toBe("Valid assistant message");
    });

    it("should truncate long messages to default 500 characters", () => {
      const longMessage = "a".repeat(600);
      const history = [createMockChatHistoryItem(longMessage, "assistant")];

      const summary = extractSummary(history);

      expect(summary?.length).toBe(500);
      expect(summary).toBe("a".repeat(497) + "...");
    });

    it("should respect custom maxLength parameter", () => {
      const longMessage = "b".repeat(200);
      const history = [createMockChatHistoryItem(longMessage, "assistant")];

      const summary = extractSummary(history, 100);

      expect(summary?.length).toBe(100);
      expect(summary).toBe("b".repeat(97) + "...");
    });

    it("should not truncate messages under the limit", () => {
      const shortMessage = "This is a short message.";
      const history = [createMockChatHistoryItem(shortMessage, "assistant")];

      const summary = extractSummary(history, 500);

      expect(summary).toBe(shortMessage);
    });

    it("should return undefined for empty history", () => {
      const summary = extractSummary([]);

      expect(summary).toBeUndefined();
    });

    it("should return undefined when no assistant messages exist", () => {
      const history = [
        createMockChatHistoryItem("User message 1", "user"),
        createMockChatHistoryItem("User message 2", "user"),
        createMockChatHistoryItem("System message", "system"),
      ];

      const summary = extractSummary(history);

      expect(summary).toBeUndefined();
    });

    it("should handle message content as object (multimodal)", () => {
      const history: ChatHistoryItem[] = [
        {
          message: {
            role: "assistant",
            content: [
              { type: "text", text: "Here's the image analysis" },
              { type: "image_url", image_url: { url: "data:..." } },
            ],
          },
        } as any,
      ];

      const summary = extractSummary(history);

      // Should stringify the object content
      expect(summary).toBeDefined();
      expect(typeof summary).toBe("string");
      expect(summary).toContain("Here's the image analysis");
    });

    it("should trim whitespace from content", () => {
      const history = [
        createMockChatHistoryItem(
          "  \n  Message with whitespace  \n  ",
          "assistant",
        ),
      ];

      const summary = extractSummary(history);

      expect(summary).toBe("Message with whitespace");
    });

    it("should find last assistant message among mixed roles", () => {
      const history = [
        createMockChatHistoryItem("First assistant message", "assistant"),
        createMockChatHistoryItem("User response", "user"),
        createMockChatHistoryItem("Second assistant message", "assistant"),
        createMockChatHistoryItem("Another user message", "user"),
        createMockChatHistoryItem("System notification", "system"),
      ];

      const summary = extractSummary(history);

      expect(summary).toBe("Second assistant message");
    });

    it("should handle markdown formatting in messages", () => {
      const history = [
        createMockChatHistoryItem(
          "I've updated the code:\n\n```typescript\nfunction test() {}\n```\n\nThe changes are complete.",
          "assistant",
        ),
      ];

      const summary = extractSummary(history);

      // Should keep markdown formatting
      expect(summary).toContain("```typescript");
      expect(summary).toContain("function test()");
    });

    it("should handle special characters in messages", () => {
      const history = [
        createMockChatHistoryItem(
          'Fixed the regex pattern: /[a-z]+/gi and added "quotes" & <tags>',
          "assistant",
        ),
      ];

      const summary = extractSummary(history);

      expect(summary).toBe(
        'Fixed the regex pattern: /[a-z]+/gi and added "quotes" & <tags>',
      );
    });

    it("should handle exactly 500 character message (no truncation)", () => {
      const exactMessage = "x".repeat(500);
      const history = [createMockChatHistoryItem(exactMessage, "assistant")];

      const summary = extractSummary(history, 500);

      expect(summary).toBe(exactMessage);
      expect(summary?.length).toBe(500);
      expect(summary?.endsWith("...")).toBe(false);
    });

    it("should handle 501 character message (with truncation)", () => {
      const longMessage = "y".repeat(501);
      const history = [createMockChatHistoryItem(longMessage, "assistant")];

      const summary = extractSummary(history, 500);

      expect(summary).toBe("y".repeat(497) + "...");
      expect(summary?.length).toBe(500);
    });
  });

  describe("getAgentIdFromArgs", () => {
    let originalArgv: string[];

    beforeEach(() => {
      originalArgv = process.argv;
    });

    afterEach(() => {
      process.argv = originalArgv;
    });

    it("should extract agent ID from --id flag", () => {
      process.argv = ["node", "script.js", "--id", "test-agent-123"];

      const agentId = getAgentIdFromArgs();

      expect(agentId).toBe("test-agent-123");
    });

    it("should return undefined when --id flag not present", () => {
      process.argv = ["node", "script.js", "--other-flag", "value"];

      const agentId = getAgentIdFromArgs();

      expect(agentId).toBeUndefined();
    });

    it("should return undefined when --id flag has no value", () => {
      process.argv = ["node", "script.js", "--id"];

      const agentId = getAgentIdFromArgs();

      expect(agentId).toBeUndefined();
    });

    it("should extract agent ID when --id is in the middle of args", () => {
      process.argv = [
        "node",
        "script.js",
        "--verbose",
        "--id",
        "my-agent-id",
        "--debug",
      ];

      const agentId = getAgentIdFromArgs();

      expect(agentId).toBe("my-agent-id");
    });

    it("should handle UUID format agent IDs", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      process.argv = ["node", "script.js", "--id", uuid];

      const agentId = getAgentIdFromArgs();

      expect(agentId).toBe(uuid);
    });

    it("should handle agent IDs with special characters", () => {
      process.argv = ["node", "script.js", "--id", "agent-123_test.prod"];

      const agentId = getAgentIdFromArgs();

      expect(agentId).toBe("agent-123_test.prod");
    });
  });

  describe("postAgentMetadata", () => {
    let mockPost: any;

    beforeEach(async () => {
      vi.clearAllMocks();

      const apiClientModule = await import("./apiClient.js");
      mockPost = vi.mocked(apiClientModule.post);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should successfully post metadata", async () => {
      mockPost.mockResolvedValue({ ok: true, status: 200 });

      await postAgentMetadata("test-agent-id", {
        additions: 5,
        deletions: 2,
        summary: "Test summary",
      });

      expect(mockPost).toHaveBeenCalledWith("agents/test-agent-id/metadata", {
        metadata: {
          additions: 5,
          deletions: 2,
          summary: "Test summary",
        },
      });
    });

    it("should handle empty metadata object", async () => {
      await postAgentMetadata("test-agent-id", {});

      expect(mockPost).not.toHaveBeenCalled();
    });

    it("should handle missing agent ID", async () => {
      await postAgentMetadata("", { additions: 1 });

      expect(mockPost).not.toHaveBeenCalled();
    });

    it("should handle API error gracefully", async () => {
      const { ApiRequestError } = await import("./apiClient.js");
      mockPost.mockRejectedValue(
        new ApiRequestError(500, "Internal Server Error", "Error details"),
      );

      // Should not throw
      await expect(
        postAgentMetadata("test-agent-id", { additions: 1 }),
      ).resolves.toBeUndefined();
    });

    it("should handle authentication error gracefully", async () => {
      const { AuthenticationRequiredError } = await import("./apiClient.js");
      mockPost.mockRejectedValue(new AuthenticationRequiredError());

      // Should not throw
      await expect(
        postAgentMetadata("test-agent-id", { additions: 1 }),
      ).resolves.toBeUndefined();
    });

    it("should handle network error gracefully", async () => {
      mockPost.mockRejectedValue(new Error("Network error"));

      // Should not throw
      await expect(
        postAgentMetadata("test-agent-id", { additions: 1 }),
      ).resolves.toBeUndefined();
    });

    it("should handle non-ok response", async () => {
      mockPost.mockResolvedValue({ ok: false, status: 404 });

      // Should not throw
      await expect(
        postAgentMetadata("test-agent-id", { additions: 1 }),
      ).resolves.toBeUndefined();
    });

    it("should post complex metadata", async () => {
      mockPost.mockResolvedValue({ ok: true, status: 200 });

      const complexMetadata = {
        additions: 10,
        deletions: 5,
        summary: "Complex changes made",
        isComplete: true,
        hasChanges: true,
        usage: {
          totalCost: 1.234567,
          promptTokens: 1000,
          completionTokens: 500,
          cachedTokens: 200,
          cacheWriteTokens: 100,
        },
      };

      await postAgentMetadata("test-agent-id", complexMetadata);

      expect(mockPost).toHaveBeenCalledWith("agents/test-agent-id/metadata", {
        metadata: complexMetadata,
      });
    });

    it("should handle metadata with nested objects", async () => {
      mockPost.mockResolvedValue({ ok: true, status: 200 });

      const metadata = {
        usage: {
          totalCost: 0.5,
          promptTokens: 100,
          completionTokens: 50,
        },
        customField: {
          nested: {
            value: "test",
          },
        },
      };

      await postAgentMetadata("test-agent-id", metadata);

      expect(mockPost).toHaveBeenCalledWith("agents/test-agent-id/metadata", {
        metadata,
      });
    });

    it("should handle metadata with null values", async () => {
      mockPost.mockResolvedValue({ ok: true, status: 200 });

      const metadata = {
        summary: null,
        additions: 0,
      };

      await postAgentMetadata("test-agent-id", metadata as any);

      expect(mockPost).toHaveBeenCalledWith("agents/test-agent-id/metadata", {
        metadata,
      });
    });

    it("should handle metadata with array values", async () => {
      mockPost.mockResolvedValue({ ok: true, status: 200 });

      const metadata = {
        files: ["file1.ts", "file2.ts", "file3.ts"],
        additions: 5,
      };

      await postAgentMetadata("test-agent-id", metadata);

      expect(mockPost).toHaveBeenCalledWith("agents/test-agent-id/metadata", {
        metadata,
      });
    });
  });
});
