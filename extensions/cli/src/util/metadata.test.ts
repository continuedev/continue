import type { ChatHistoryItem } from "core/index.js";
import { beforeEach, afterEach, describe, expect, it } from "vitest";

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
    originalArgv = [...process.argv];
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

  describe("flag variations", () => {
    it("should not match --identity flag", () => {
      process.argv = ["node", "script.js", "--identity", "not-an-id"];
      expect(getAgentIdFromArgs()).toBeUndefined();
    });

    it("should not match --idempotent flag", () => {
      process.argv = ["node", "script.js", "--idempotent"];
      expect(getAgentIdFromArgs()).toBeUndefined();
    });

    it("should handle --id= format (not supported)", () => {
      process.argv = ["node", "script.js", "--id=test-123"];
      // Current implementation doesn't support --id=value format
      expect(getAgentIdFromArgs()).toBeUndefined();
    });

    it("should handle negative numbers as ID", () => {
      process.argv = ["node", "script.js", "--id", "-123"];
      expect(getAgentIdFromArgs()).toBe("-123");
    });

    it("should handle numeric string IDs", () => {
      process.argv = ["node", "script.js", "--id", "12345"];
      expect(getAgentIdFromArgs()).toBe("12345");
    });

    it("should handle IDs with paths", () => {
      process.argv = ["node", "script.js", "--id", "agent/session/123"];
      expect(getAgentIdFromArgs()).toBe("agent/session/123");
    });

    it("should handle IDs with URL format", () => {
      const urlId = "https://example.com/agent/123";
      process.argv = ["node", "script.js", "--id", urlId];
      expect(getAgentIdFromArgs()).toBe(urlId);
    });

    it("should handle IDs with JSON", () => {
      const jsonId = '{"type":"agent","id":123}';
      process.argv = ["node", "script.js", "--id", jsonId];
      expect(getAgentIdFromArgs()).toBe(jsonId);
    });
  });
});

describe("calculateDiffStats - special patterns", () => {
  it("should correctly handle C++ increment/decrement operators", () => {
    const diff = `
+    counter++;
-    counter--;
+    ++value;
-    --value;
`;
    expect(calculateDiffStats(diff)).toEqual({ additions: 2, deletions: 2 });
  });

  it("should handle arrow operator patterns", () => {
    const diff = `
+    ptr->field;
-    obj-->method();
`;
    expect(calculateDiffStats(diff)).toEqual({ additions: 1, deletions: 1 });
  });

  it("should handle comment-only changes", () => {
    const diff = `
+    // Added comment
-    // Removed comment
+    /* Multi-line
+       comment */
`;
    expect(calculateDiffStats(diff)).toEqual({ additions: 3, deletions: 1 });
  });

  it("should handle empty line changes", () => {
    const diff = `
+
-
+    
`;
    expect(calculateDiffStats(diff)).toEqual({ additions: 2, deletions: 1 });
  });

  it("should handle diff with only context lines", () => {
    const diff = `
@@ -1,3 +1,3 @@
 const x = 1;
 const y = 2;
 const z = 3;
`;
    expect(calculateDiffStats(diff)).toEqual({ additions: 0, deletions: 0 });
  });

  it("should handle conflict markers", () => {
    const diff = `
+<<<<<<< HEAD
+const x = 1;
+=======
+const x = 2;
+>>>>>>> branch
`;
    // Conflict markers are counted as additions if they appear in diff
    expect(calculateDiffStats(diff)).toEqual({ additions: 5, deletions: 0 });
  });

  it("should handle permission changes without content changes", () => {
    const diff = `
diff --git a/script.sh b/script.sh
old mode 100644
new mode 100755
`;
    expect(calculateDiffStats(diff)).toEqual({ additions: 0, deletions: 0 });
  });

  it("should handle symlink changes", () => {
    const diff = `
diff --git a/link b/link
new file mode 120000
index 0000000..abc123
--- /dev/null
+++ b/link
@@ -0,0 +1 @@
+target/file
`;
    expect(calculateDiffStats(diff)).toEqual({ additions: 1, deletions: 0 });
  });

  it("should handle renamed files with no changes", () => {
    const diff = `
diff --git a/old.js b/new.js
similarity index 100%
rename from old.js
rename to new.js
`;
    expect(calculateDiffStats(diff)).toEqual({ additions: 0, deletions: 0 });
  });

  it("should handle renamed files with changes", () => {
    const diff = `
diff --git a/old.js b/new.js
similarity index 90%
rename from old.js
rename to new.js
index abc123..def456 100644
--- a/old.js
+++ b/new.js
@@ -1,3 +1,4 @@
 const x = 1;
+const y = 2;
 const z = 3;
`;
    expect(calculateDiffStats(diff)).toEqual({ additions: 1, deletions: 0 });
  });

  it("should handle diff with many small hunks efficiently", () => {
    const hunks = Array.from(
      { length: 1000 },
      (_, i) => `
@@ -${i},1 +${i},2 @@
 context line
+added line ${i}
 context line
`,
    ).join("");

    const start = Date.now();
    const result = calculateDiffStats(hunks);
    const duration = Date.now() - start;

    expect(result.additions).toBe(1000);
    expect(result.deletions).toBe(0);
    expect(duration).toBeLessThan(1000); // Should complete in under 1 second
  });

  it("should handle diff with very long lines", () => {
    const longLine = "a".repeat(100000);
    const diff = `+${longLine}\n-${longLine}`;

    const result = calculateDiffStats(diff);
    expect(result).toEqual({ additions: 1, deletions: 1 });
  });
});

describe("extractSummary - advanced content handling", () => {
  const createHistoryItem = (
    content: any,
    role: "user" | "assistant" | "system" = "assistant",
  ): ChatHistoryItem =>
    ({
      message: { role, content },
    }) as ChatHistoryItem;

  it("should handle messages with markdown formatting", () => {
    const markdown = `
# Header

**Bold text** and *italic text*

- List item 1
- List item 2

\`\`\`javascript
code block
\`\`\`
`;
    const history = [createHistoryItem(markdown)];
    const result = extractSummary(history);
    expect(result).toBe(markdown.trim());
  });

  it("should handle messages with special characters", () => {
    const specialChars = "Test with <>&\"'\n\t special chars";
    const history = [createHistoryItem(specialChars)];
    expect(extractSummary(history)).toBe(specialChars.trim());
  });

  it("should handle messages with emoji", () => {
    const emoji = "Test message 🎉 with emoji 🚀";
    const history = [createHistoryItem(emoji)];
    expect(extractSummary(history)).toBe(emoji);
  });

  it("should handle messages with code blocks", () => {
    const codeMessage = "Here's the code:\n\`\`\`\nfunction test() {}\n\`\`\`";
    const history = [createHistoryItem(codeMessage)];
    expect(extractSummary(history)).toBe(codeMessage.trim());
  });

  it("should handle nested JSON objects", () => {
    const nestedObj = {
      level1: {
        level2: {
          level3: { data: "deep" },
        },
      },
    };
    const history = [createHistoryItem(nestedObj)];
    expect(extractSummary(history)).toBe(JSON.stringify(nestedObj));
  });

  it("should handle null content gracefully", () => {
    const history = [createHistoryItem(null)];
    expect(extractSummary(history)).toBeUndefined();
  });

  it("should skip messages with only whitespace variations", () => {
    const history = [
      createHistoryItem("Valid message"),
      createHistoryItem("   \n   "),
      createHistoryItem("\t\t\t"),
      createHistoryItem("\r\n\r\n"),
    ];
    expect(extractSummary(history)).toBe("Valid message");
  });

  it("should handle very long words without spaces", () => {
    const longWord = "a".repeat(1000);
    const history = [createHistoryItem(longWord)];
    const result = extractSummary(history, 500);
    expect(result?.length).toBe(500);
    expect(result?.endsWith("...")).toBe(true);
  });

  it("should handle mixed content types in history", () => {
    const history = [
      createHistoryItem("String"),
      createHistoryItem({ type: "object" }),
      createHistoryItem(["array"]),
      createHistoryItem("Last string"),
    ];
    expect(extractSummary(history)).toBe("Last string");
  });

  it("should handle maxLength of 1", () => {
    const history = [createHistoryItem("Test")];
    const result = extractSummary(history, 1);
    expect(result?.length).toBe(1);
    // Since maxLength is 1, substring(0, -2) returns empty string, then we add "..."
    expect(result).toBe("...");
  });

  it("should handle maxLength of 3", () => {
    const history = [createHistoryItem("Test")];
    const result = extractSummary(history, 3);
    expect(result?.length).toBe(3);
    expect(result).toBe("...");
  });

  it("should handle maxLength of 4", () => {
    const history = [createHistoryItem("Test")];
    const result = extractSummary(history, 4);
    // "Test" is exactly 4 chars, should not truncate
    expect(result).toBe("Test");
  });

  it("should handle multiline content with custom maxLength", () => {
    const multiline = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5";
    const history = [createHistoryItem(multiline)];
    const result = extractSummary(history, 20);
    expect(result?.length).toBe(20);
    expect(result).toBe("Line 1\nLine 2\nLi...");
  });

  it("should preserve unicode characters when truncating", () => {
    const unicode = "🚀🚀🚀🚀🚀"; // 5 rocket emojis
    const longText = unicode.repeat(100); // 500 emojis
    const history = [createHistoryItem(longText)];
    const result = extractSummary(history, 50);
    expect(result?.length).toBe(50);
    expect(result?.endsWith("...")).toBe(true);
  });
});

describe("calculateDiffStats - additional edge cases", () => {
  it("should handle diff with trailing newlines", () => {
    const diff = "+line1\n+line2\n\n\n";
    expect(calculateDiffStats(diff)).toEqual({ additions: 2, deletions: 0 });
  });

  it("should handle diff with no newline at end", () => {
    const diff = "+line1\n+line2";
    expect(calculateDiffStats(diff)).toEqual({ additions: 2, deletions: 0 });
  });

  it("should handle diff with tabs", () => {
    const diff = "+\tindented line\n-\tanother indented line";
    expect(calculateDiffStats(diff)).toEqual({ additions: 1, deletions: 1 });
  });

  it("should handle git submodule changes", () => {
    const diff = `
diff --git a/.gitmodules b/.gitmodules
index abc123..def456 100644
--- a/.gitmodules
+++ b/.gitmodules
@@ -1,3 +1,3 @@
 [submodule "lib"]
   path = lib
-  url = https://old-url.com/lib.git
+  url = https://new-url.com/lib.git
`;
    expect(calculateDiffStats(diff)).toEqual({ additions: 1, deletions: 1 });
  });

  it("should handle merge conflicts resolved", () => {
    const diff = `
-<<<<<<< HEAD
-const x = 1;
-=======
-const x = 2;
->>>>>>> branch
+const x = 3;
`;
    expect(calculateDiffStats(diff)).toEqual({ additions: 1, deletions: 5 });
  });

  it("should handle empty hunks", () => {
    const diff = `
diff --git a/file.ts b/file.ts
index abc123..def456 100644
--- a/file.ts
+++ b/file.ts
@@ -0,0 +0,0 @@
`;
    expect(calculateDiffStats(diff)).toEqual({ additions: 0, deletions: 0 });
  });

  it("should handle diffs with Git attributes", () => {
    const diff = `
diff --git a/.gitattributes b/.gitattributes
new file mode 100644
index 0000000..abc123
--- /dev/null
+++ b/.gitattributes
@@ -0,0 +1,2 @@
+*.js text eol=lf
+*.png binary
`;
    expect(calculateDiffStats(diff)).toEqual({ additions: 2, deletions: 0 });
  });

  it("should handle diff with only +++ at line start", () => {
    const diff = "+++";
    expect(calculateDiffStats(diff)).toEqual({ additions: 0, deletions: 0 });
  });

  it("should handle diff with only --- at line start", () => {
    const diff = "---";
    expect(calculateDiffStats(diff)).toEqual({ additions: 0, deletions: 0 });
  });

  it("should handle multiple consecutive + or - lines", () => {
    const diff = `
+++++line
-----line
+++
---
+normal
-normal
`;
    expect(calculateDiffStats(diff)).toEqual({ additions: 2, deletions: 2 });
  });

  it("should handle diff with Windows path separators", () => {
    const diff = `
diff --git a/path\\to\\file.ts b/path\\to\\file.ts
--- a/path\\to\\file.ts
+++ b/path\\to\\file.ts
+added line
`;
    expect(calculateDiffStats(diff)).toEqual({ additions: 1, deletions: 0 });
  });

  it("should handle diff with quoted filenames", () => {
    const diff = `
diff --git "a/file with spaces.ts" "b/file with spaces.ts"
--- "a/file with spaces.ts"
+++ "b/file with spaces.ts"
+added line
`;
    expect(calculateDiffStats(diff)).toEqual({ additions: 1, deletions: 0 });
  });

  it("should handle diff with unicode in filenames", () => {
    const diff = `
diff --git a/文件.ts b/文件.ts
--- a/文件.ts
+++ b/文件.ts
+added line
`;
    expect(calculateDiffStats(diff)).toEqual({ additions: 1, deletions: 0 });
  });

  it("should handle diff starting with + or - without metadata", () => {
    const diff = "+added\n-removed\n+another";
    expect(calculateDiffStats(diff)).toEqual({ additions: 2, deletions: 1 });
  });

  it("should handle diff with extended header info", () => {
    const diff = `
diff --git a/file.ts b/file.ts
index abc123..def456 100644
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
old mode 100644
new mode 100755
+added line
`;
    expect(calculateDiffStats(diff)).toEqual({ additions: 1, deletions: 0 });
  });

  it("should handle diff with copy detection", () => {
    const diff = `
diff --git a/original.ts b/copy.ts
similarity index 95%
copy from original.ts
copy to copy.ts
index abc123..def456 100644
--- a/original.ts
+++ b/copy.ts
@@ -1,3 +1,4 @@
 const x = 1;
+const y = 2;
 const z = 3;
`;
    expect(calculateDiffStats(diff)).toEqual({ additions: 1, deletions: 0 });
  });
});

describe("extractSummary - truncation edge cases", () => {
  const createHistoryItem = (
    content: any,
    role: "user" | "assistant" | "system" = "assistant",
  ): ChatHistoryItem =>
    ({
      message: { role, content },
    }) as ChatHistoryItem;

  it("should handle maxLength of 0", () => {
    const history = [createHistoryItem("Test")];
    const result = extractSummary(history, 0);
    // When maxLength is 0, should return empty with ...
    expect(result).toBe("...");
  });

  it("should handle maxLength of 2", () => {
    const history = [createHistoryItem("Test")];
    const result = extractSummary(history, 2);
    expect(result?.length).toBe(2);
    expect(result).toBe("...");
  });

  it("should handle message exactly maxLength - 3", () => {
    const history = [createHistoryItem("ab")];
    const result = extractSummary(history, 5);
    // "ab" is 2 chars, maxLength is 5, so no truncation needed
    expect(result).toBe("ab");
  });

  it("should handle truncation at word boundary", () => {
    const message = "This is a very long message that needs truncation";
    const history = [createHistoryItem(message)];
    const result = extractSummary(history, 20);
    expect(result?.length).toBe(20);
    expect(result).toBe("This is a very lo...");
  });

  it("should handle message with URLs", () => {
    const message =
      "Check out https://example.com/very/long/path/to/resource for more info";
    const history = [createHistoryItem(message)];
    const result = extractSummary(history, 30);
    expect(result?.length).toBe(30);
    expect(result).toBe("Check out https://example....");
  });

  it("should handle message with control characters", () => {
    const message = "Line1\r\nLine2\r\nLine3";
    const history = [createHistoryItem(message)];
    const result = extractSummary(history);
    expect(result).toBe(message.trim());
  });

  it("should handle message with only spaces", () => {
    const history = [createHistoryItem("     ")];
    expect(extractSummary(history)).toBeUndefined();
  });

  it("should handle message with leading/trailing newlines", () => {
    const message = "\n\n\nActual content\n\n\n";
    const history = [createHistoryItem(message)];
    expect(extractSummary(history)).toBe("Actual content");
  });

  it("should handle very large maxLength", () => {
    const message = "Short message";
    const history = [createHistoryItem(message)];
    const result = extractSummary(history, 1000000);
    expect(result).toBe(message);
  });

  it("should handle negative maxLength", () => {
    const history = [createHistoryItem("Test")];
    const result = extractSummary(history, -1);
    // Negative maxLength should still work (substring behavior)
    expect(result).toBe("...");
  });
});

describe("getAgentIdFromArgs - additional cases", () => {
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = [...process.argv];
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  it("should handle --id with dashes and underscores", () => {
    const id = "agent-id_with-both_separators-123";
    process.argv = ["node", "script.js", "--id", id];
    expect(getAgentIdFromArgs()).toBe(id);
  });

  it("should be case sensitive for flag", () => {
    process.argv = ["node", "script.js", "--ID", "test"];
    expect(getAgentIdFromArgs()).toBeUndefined();
  });

  it("should be case sensitive for flag (--Id)", () => {
    process.argv = ["node", "script.js", "--Id", "test"];
    expect(getAgentIdFromArgs()).toBeUndefined();
  });

  it("should handle ID with only special characters", () => {
    const id = "!@#$%^&*()";
    process.argv = ["node", "script.js", "--id", id];
    expect(getAgentIdFromArgs()).toBe(id);
  });

  it("should handle ID with newlines (shell escaped)", () => {
    const id = "id\\nwith\\nnewlines";
    process.argv = ["node", "script.js", "--id", id];
    expect(getAgentIdFromArgs()).toBe(id);
  });

  it("should handle ID with tabs", () => {
    const id = "id\\twith\\ttabs";
    process.argv = ["node", "script.js", "--id", id];
    expect(getAgentIdFromArgs()).toBe(id);
  });

  it("should handle ID that looks like a flag", () => {
    const id = "--not-a-flag";
    process.argv = ["node", "script.js", "--id", id];
    expect(getAgentIdFromArgs()).toBe(id);
  });

  it("should handle ID that is a number", () => {
    process.argv = ["node", "script.js", "--id", "0"];
    expect(getAgentIdFromArgs()).toBe("0");
  });

  it("should handle ID with base64 encoding", () => {
    const id = "YWdlbnQtaWQtMTIzNDU2Nzg5MA==";
    process.argv = ["node", "script.js", "--id", id];
    expect(getAgentIdFromArgs()).toBe(id);
  });

  it("should handle ID with unicode characters", () => {
    const id = "agent-🚀-id-🎉";
    process.argv = ["node", "script.js", "--id", id];
    expect(getAgentIdFromArgs()).toBe(id);
  });

  it("should handle very short ID", () => {
    process.argv = ["node", "script.js", "--id", "a"];
    expect(getAgentIdFromArgs()).toBe("a");
  });

  it("should handle ID with repeated characters", () => {
    const id = "aaaaaaaaaa";
    process.argv = ["node", "script.js", "--id", id];
    expect(getAgentIdFromArgs()).toBe(id);
  });

  it("should handle --id in middle of command", () => {
    process.argv = [
      "node",
      "script.js",
      "command",
      "--verbose",
      "--id",
      "mid-id",
      "--debug",
      "arg",
    ];
    expect(getAgentIdFromArgs()).toBe("mid-id");
  });

  it("should handle --id followed by another flag", () => {
    process.argv = ["node", "script.js", "--id", "test-id", "--verbose"];
    expect(getAgentIdFromArgs()).toBe("test-id");
  });

  it("should return first --id when multiple exist with same value", () => {
    process.argv = ["node", "script.js", "--id", "same-id", "--id", "same-id"];
    expect(getAgentIdFromArgs()).toBe("same-id");
  });
});

describe("extractSummary - role precedence", () => {
  const createHistoryItem = (
    content: any,
    role: "user" | "assistant" | "system" = "assistant",
  ): ChatHistoryItem =>
    ({
      message: { role, content },
    }) as ChatHistoryItem;

  it("should prioritize most recent assistant over older ones", () => {
    const history = [
      createHistoryItem("First assistant"),
      createHistoryItem("User message", "user"),
      createHistoryItem("Second assistant"),
      createHistoryItem("Third assistant"),
    ];
    expect(extractSummary(history)).toBe("Third assistant");
  });

  it("should skip all non-assistant messages", () => {
    const history = [
      createHistoryItem("System 1", "system"),
      createHistoryItem("User 1", "user"),
      createHistoryItem("System 2", "system"),
      createHistoryItem("User 2", "user"),
      createHistoryItem("Assistant message"),
      createHistoryItem("System 3", "system"),
      createHistoryItem("User 3", "user"),
    ];
    expect(extractSummary(history)).toBe("Assistant message");
  });

  it("should handle history with only system messages", () => {
    const history = [
      createHistoryItem("System 1", "system"),
      createHistoryItem("System 2", "system"),
    ];
    expect(extractSummary(history)).toBeUndefined();
  });

  it("should handle alternating user and assistant", () => {
    const history = [
      createHistoryItem("User 1", "user"),
      createHistoryItem("Assistant 1"),
      createHistoryItem("User 2", "user"),
      createHistoryItem("Assistant 2"),
      createHistoryItem("User 3", "user"),
      createHistoryItem("Assistant 3"),
    ];
    expect(extractSummary(history)).toBe("Assistant 3");
  });
});

describe("calculateDiffStats - performance characteristics", () => {
  it("should handle extremely large files efficiently", () => {
    const lines = Array.from({ length: 50000 }, (_, i) => `+line ${i}`).join(
      "\n",
    );
    const diff = `
diff --git a/huge.txt b/huge.txt
--- a/huge.txt
+++ b/huge.txt
${lines}
`;

    const start = Date.now();
    const result = calculateDiffStats(diff);
    const duration = Date.now() - start;

    expect(result.additions).toBe(50000);
    expect(duration).toBeLessThan(2000); // Should be fast
  });

  it("should handle diffs with mixed metadata and content", () => {
    const segments = Array.from(
      { length: 100 },
      (_, i) => `
diff --git a/file${i}.ts b/file${i}.ts
index abc${i}..def${i} 100644
--- a/file${i}.ts
+++ b/file${i}.ts
@@ -1,1 +1,2 @@
 const x = ${i};
+const y = ${i};
`,
    ).join("");

    const result = calculateDiffStats(segments);
    expect(result.additions).toBe(100);
    expect(result.deletions).toBe(0);
  });
});
