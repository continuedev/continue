import type { ChatHistoryItem } from "core/index.js";
import { describe, expect, it } from "vitest";

import {
  calculateDiffStats,
  extractSummary,
  getAgentIdFromArgs,
} from "./metadata.js";

describe("calculateDiffStats", () => {
  describe("basic functionality", () => {
    it("should return zero stats for empty diff", () => {
      expect(calculateDiffStats("")).toEqual({ additions: 0, deletions: 0 });
    });

    it("should return zero stats for whitespace-only diff", () => {
      expect(calculateDiffStats("   \n\n\t  ")).toEqual({
        additions: 0,
        deletions: 0,
      });
    });

    it("should count simple additions", () => {
      const diff = `
diff --git a/file.ts b/file.ts
index abc123..def456 100644
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,4 @@
 const x = 1;
+const y = 2;
 const z = 3;
`;
      expect(calculateDiffStats(diff)).toEqual({ additions: 1, deletions: 0 });
    });

    it("should count simple deletions", () => {
      const diff = `
diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,2 @@
 const x = 1;
-const y = 2;
 const z = 3;
`;
      expect(calculateDiffStats(diff)).toEqual({ additions: 0, deletions: 1 });
    });

    it("should count both additions and deletions", () => {
      const diff = `
diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
-const x = 1;
+const x = 2;
 const y = 2;
+const z = 3;
-const old = 1;
`;
      expect(calculateDiffStats(diff)).toEqual({ additions: 2, deletions: 2 });
    });
  });

  describe("metadata line filtering", () => {
    it("should ignore file header lines with spaces", () => {
      const diff = `
--- a/file.ts
+++ b/file.ts
+actual addition
`;
      expect(calculateDiffStats(diff)).toEqual({ additions: 1, deletions: 0 });
    });

    it("should ignore hunk headers", () => {
      const diff = `
@@ -1,3 +1,4 @@
+addition
`;
      expect(calculateDiffStats(diff)).toEqual({ additions: 1, deletions: 0 });
    });

    it("should ignore diff metadata lines", () => {
      const diff = `
diff --git a/file.ts b/file.ts
index abc123..def456 100644
+addition
`;
      expect(calculateDiffStats(diff)).toEqual({ additions: 1, deletions: 0 });
    });

    it("should ignore binary file markers", () => {
      const diff = `
Binary files a/image.png and b/image.png differ
+text addition
`;
      expect(calculateDiffStats(diff)).toEqual({ additions: 1, deletions: 0 });
    });

    it("should count lines starting with +++ without space as code", () => {
      const diff = `
+++ b/file.ts
+++counter;
`;
      expect(calculateDiffStats(diff)).toEqual({ additions: 1, deletions: 0 });
    });

    it("should count lines starting with --- without space as code", () => {
      const diff = `
--- a/file.ts
---counter;
`;
      expect(calculateDiffStats(diff)).toEqual({ additions: 0, deletions: 1 });
    });
  });

  describe("edge cases", () => {
    it("should handle multiple files in one diff", () => {
      const diff = `
diff --git a/file1.ts b/file1.ts
--- a/file1.ts
+++ b/file1.ts
+addition in file1
-deletion in file1
diff --git a/file2.ts b/file2.ts
--- a/file2.ts
+++ b/file2.ts
+addition in file2
+another addition in file2
`;
      expect(calculateDiffStats(diff)).toEqual({ additions: 3, deletions: 1 });
    });

    it("should handle very large diffs", () => {
      const additions = Array.from({ length: 10000 }, () => "+added line").join(
        "\n",
      );
      const deletions = Array.from(
        { length: 5000 },
        () => "-deleted line",
      ).join("\n");
      const diff = `${additions}\n${deletions}`;

      expect(calculateDiffStats(diff)).toEqual({
        additions: 10000,
        deletions: 5000,
      });
    });

    it("should handle diff with only metadata", () => {
      const diff = `
diff --git a/file.ts b/file.ts
index abc123..def456 100644
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
`;
      expect(calculateDiffStats(diff)).toEqual({ additions: 0, deletions: 0 });
    });

    it("should handle mixed line endings", () => {
      const diff = "+line1\r\n-line2\r+line3\n-line4";
      expect(calculateDiffStats(diff)).toEqual({ additions: 2, deletions: 2 });
    });
  });

  describe("real-world scenarios", () => {
    it("should handle refactoring with many changes", () => {
      const diff = `
diff --git a/src/component.tsx b/src/component.tsx
index abc123..def456 100644
--- a/src/component.tsx
+++ b/src/component.tsx
@@ -10,15 +10,20 @@ import React from "react";
-export function OldComponent() {
+export function NewComponent() {
   const [state, setState] = useState(0);
-  const oldLogic = () => {
-    console.log("old");
-  };
+  const newLogic = () => {
+    console.log("new");
+    console.log("improved");
+  };
   return (
-    <div className="old">
+    <div className="new">
+      <span>Extra element</span>
       {state}
     </div>
   );
 }
`;
      expect(calculateDiffStats(diff)).toEqual({ additions: 8, deletions: 5 });
    });

    it("should handle adding a new file", () => {
      const diff = `
diff --git a/new-file.ts b/new-file.ts
new file mode 100644
index 0000000..abc123
--- /dev/null
+++ b/new-file.ts
@@ -0,0 +1,5 @@
+export const newFunction = () => {
+  console.log("new");
+  return true;
+};
+
`;
      expect(calculateDiffStats(diff)).toEqual({ additions: 5, deletions: 0 });
    });

    it("should handle deleting a file", () => {
      const diff = `
diff --git a/old-file.ts b/old-file.ts
deleted file mode 100644
index abc123..0000000
--- a/old-file.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-export const oldFunction = () => {
-  return false;
-};
`;
      expect(calculateDiffStats(diff)).toEqual({ additions: 0, deletions: 3 });
    });
  });
});

describe("extractSummary", () => {
  const createHistoryItem = (
    content: string,
    role: "user" | "assistant" | "system" = "assistant",
  ): ChatHistoryItem =>
    ({
      message: { role, content },
    }) as ChatHistoryItem;

  describe("basic functionality", () => {
    it("should return undefined for empty history", () => {
      expect(extractSummary([])).toBeUndefined();
    });

    it("should extract last assistant message", () => {
      const history = [
        createHistoryItem("User message", "user"),
        createHistoryItem("Assistant response", "assistant"),
      ];
      expect(extractSummary(history)).toBe("Assistant response");
    });

    it("should find last assistant message when followed by user message", () => {
      const history = [
        createHistoryItem("First assistant", "assistant"),
        createHistoryItem("User question", "user"),
      ];
      expect(extractSummary(history)).toBe("First assistant");
    });

    it("should return most recent assistant message", () => {
      const history = [
        createHistoryItem("Old assistant", "assistant"),
        createHistoryItem("User", "user"),
        createHistoryItem("Recent assistant", "assistant"),
      ];
      expect(extractSummary(history)).toBe("Recent assistant");
    });

    it("should skip empty assistant messages", () => {
      const history = [
        createHistoryItem("Good message", "assistant"),
        createHistoryItem("", "assistant"),
        createHistoryItem("   ", "assistant"),
      ];
      expect(extractSummary(history)).toBe("Good message");
    });

    it("should trim whitespace from message", () => {
      const history = [
        createHistoryItem("  \n  Message with whitespace  \n  ", "assistant"),
      ];
      expect(extractSummary(history)).toBe("Message with whitespace");
    });
  });

  describe("truncation behavior", () => {
    it("should not truncate short messages", () => {
      const shortMessage = "Short message";
      const history = [createHistoryItem(shortMessage, "assistant")];
      expect(extractSummary(history)).toBe(shortMessage);
    });

    it("should truncate messages exceeding maxLength", () => {
      const longMessage = "a".repeat(600);
      const history = [createHistoryItem(longMessage, "assistant")];
      const result = extractSummary(history);

      expect(result?.length).toBe(500);
      expect(result?.endsWith("...")).toBe(true);
      expect(result?.substring(0, 497)).toBe("a".repeat(497));
    });

    it("should respect custom maxLength", () => {
      const message = "a".repeat(200);
      const history = [createHistoryItem(message, "assistant")];
      const result = extractSummary(history, 100);

      expect(result?.length).toBe(100);
      expect(result?.endsWith("...")).toBe(true);
    });

    it("should handle exactly maxLength message", () => {
      const message = "a".repeat(500);
      const history = [createHistoryItem(message, "assistant")];
      expect(extractSummary(history)).toBe(message);
    });

    it("should handle maxLength + 1 message", () => {
      const message = "a".repeat(501);
      const history = [createHistoryItem(message, "assistant")];
      const result = extractSummary(history);

      expect(result?.length).toBe(500);
      expect(result?.endsWith("...")).toBe(true);
    });
  });

  describe("role filtering", () => {
    it("should ignore user messages", () => {
      const history = [
        createHistoryItem("User message", "user"),
        createHistoryItem("Assistant message", "assistant"),
        createHistoryItem("Another user", "user"),
      ];
      expect(extractSummary(history)).toBe("Assistant message");
    });

    it("should ignore system messages", () => {
      const history = [
        createHistoryItem("System message", "system"),
        createHistoryItem("Assistant message", "assistant"),
      ];
      expect(extractSummary(history)).toBe("Assistant message");
    });

    it("should return undefined when no assistant messages", () => {
      const history = [
        createHistoryItem("User 1", "user"),
        createHistoryItem("System", "system"),
        createHistoryItem("User 2", "user"),
      ];
      expect(extractSummary(history)).toBeUndefined();
    });

    it("should handle mixed roles correctly", () => {
      const history = [
        createHistoryItem("System init", "system"),
        createHistoryItem("User query", "user"),
        createHistoryItem("First assistant", "assistant"),
        createHistoryItem("User followup", "user"),
        createHistoryItem("Second assistant", "assistant"),
        createHistoryItem("User final", "user"),
      ];
      expect(extractSummary(history)).toBe("Second assistant");
    });
  });

  describe("content type handling", () => {
    it("should handle string content", () => {
      const history = [createHistoryItem("String content", "assistant")];
      expect(extractSummary(history)).toBe("String content");
    });

    it("should stringify non-string content", () => {
      const objectContent = { type: "object", data: "value" };
      const history = [
        {
          message: { role: "assistant", content: objectContent },
        } as ChatHistoryItem,
      ];
      expect(extractSummary(history)).toBe(JSON.stringify(objectContent));
    });

    it("should handle array content", () => {
      const arrayContent = ["item1", "item2"];
      const history = [
        {
          message: { role: "assistant", content: arrayContent },
        } as ChatHistoryItem,
      ];
      expect(extractSummary(history)).toBe(JSON.stringify(arrayContent));
    });
  });

  describe("edge cases", () => {
    it("should handle very long conversation history", () => {
      const history = Array.from({ length: 10000 }, (_, i) =>
        createHistoryItem(`Message ${i}`, i % 2 === 0 ? "user" : "assistant"),
      );
      expect(extractSummary(history)).toBe("Message 9999");
    });

    it("should handle history with undefined content", () => {
      const history = [
        {
          message: { role: "assistant", content: undefined },
        } as any,
      ];
      // Should skip undefined content
      expect(extractSummary(history)).toBeUndefined();
    });

    it("should handle multiple empty messages before valid one", () => {
      const history = [
        createHistoryItem("Valid message", "assistant"),
        createHistoryItem("", "assistant"),
        createHistoryItem("   \n\t   ", "assistant"),
        createHistoryItem(null as any, "assistant"),
      ];
      expect(extractSummary(history)).toBe("Valid message");
    });
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

  describe("basic functionality", () => {
    it("should return undefined when --id flag is not present", () => {
      process.argv = ["node", "script.js", "--other-flag", "value"];
      expect(getAgentIdFromArgs()).toBeUndefined();
    });

    it("should extract agent ID when --id flag is present", () => {
      process.argv = ["node", "script.js", "--id", "agent-123"];
      expect(getAgentIdFromArgs()).toBe("agent-123");
    });

    it("should return undefined when --id is last argument", () => {
      process.argv = ["node", "script.js", "--id"];
      expect(getAgentIdFromArgs()).toBeUndefined();
    });

    it("should extract ID with multiple flags", () => {
      process.argv = [
        "node",
        "script.js",
        "--verbose",
        "--id",
        "agent-456",
        "--debug",
      ];
      expect(getAgentIdFromArgs()).toBe("agent-456");
    });
  });

  describe("edge cases", () => {
    it("should handle empty argv", () => {
      process.argv = [];
      expect(getAgentIdFromArgs()).toBeUndefined();
    });

    it("should handle --id with empty string value", () => {
      process.argv = ["node", "script.js", "--id", ""];
      expect(getAgentIdFromArgs()).toBe("");
    });

    it("should handle --id with whitespace value", () => {
      process.argv = ["node", "script.js", "--id", "   "];
      expect(getAgentIdFromArgs()).toBe("   ");
    });

    it("should handle UUID format ID", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      process.argv = ["node", "script.js", "--id", uuid];
      expect(getAgentIdFromArgs()).toBe(uuid);
    });

    it("should handle ID with special characters", () => {
      const specialId = "agent-id_with.special@chars#123";
      process.argv = ["node", "script.js", "--id", specialId];
      expect(getAgentIdFromArgs()).toBe(specialId);
    });

    it("should handle multiple --id flags (returns first)", () => {
      process.argv = [
        "node",
        "script.js",
        "--id",
        "first-id",
        "--id",
        "second-id",
      ];
      expect(getAgentIdFromArgs()).toBe("first-id");
    });

    it("should handle very long agent ID", () => {
      const longId = "a".repeat(1000);
      process.argv = ["node", "script.js", "--id", longId];
      expect(getAgentIdFromArgs()).toBe(longId);
    });
  });

  describe("real-world scenarios", () => {
    it("should extract ID from typical CLI invocation", () => {
      process.argv = [
        "/usr/local/bin/node",
        "/usr/local/bin/continue-cli",
        "serve",
        "--id",
        "session-abc123",
        "--prompt",
        "Fix the bug",
      ];
      expect(getAgentIdFromArgs()).toBe("session-abc123");
    });

    it("should handle ID as first argument", () => {
      process.argv = ["node", "script.js", "--id", "early-id", "command"];
      expect(getAgentIdFromArgs()).toBe("early-id");
    });

    it("should handle ID as last valid argument", () => {
      process.argv = ["node", "script.js", "command", "--id", "last-id"];
      expect(getAgentIdFromArgs()).toBe("last-id");
    });
  });
});
