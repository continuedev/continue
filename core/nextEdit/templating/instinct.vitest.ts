import { describe, expect, test } from "vitest";
import { Position } from "../..";
import {
  contextSnippetsBlock,
  currentFileContentBlock,
  editHistoryBlock,
} from "./instinct";

describe("contextSnippetsBlock", () => {
  test("should format empty context snippets", () => {
    const result = contextSnippetsBlock("");
    expect(result).toBe("");
  });

  test("should format single context snippet with codestral style header", () => {
    const input = `+++++ src/utils.ts
function helper() {
  return "test";
}`;

    const expected = `<|context_file|>: src/utils.ts
<|snippet|>
function helper() {
  return "test";
}`;

    const result = contextSnippetsBlock(input);
    expect(result).toBe(expected);
  });

  test("should format multiple context snippets", () => {
    const input = `+++++ src/file1.ts
const var1 = "value1";

+++++ src/file2.ts
const var2 = "value2";
function test() {}`;

    const expected = `<|context_file|>: src/file1.ts
<|snippet|>
const var1 = "value1";

<|context_file|>: src/file2.ts
<|snippet|>
const var2 = "value2";
function test() {}`;

    const result = contextSnippetsBlock(input);
    expect(result).toBe(expected);
  });

  test("should handle context snippet without content", () => {
    const input = "+++++ src/empty.ts";

    const expected = `<|context_file|>: src/empty.ts`;

    const result = contextSnippetsBlock(input);
    expect(result).toBe(expected);
  });

  test("should handle malformed headers gracefully", () => {
    const input = `not a header
+++++ src/valid.ts
valid content`;

    const expected = `not a header
<|context_file|>: src/valid.ts
<|snippet|>
valid content`;

    const result = contextSnippetsBlock(input);
    expect(result).toBe(expected);
  });

  test("should handle multiple consecutive headers", () => {
    const input = `+++++ src/file1.ts
+++++ src/file2.ts
content after headers`;

    const expected = `<|context_file|>: src/file1.ts
<|context_file|>: src/file2.ts
<|snippet|>
content after headers`;

    const result = contextSnippetsBlock(input);
    expect(result).toBe(expected);
  });
});

describe("currentFileContentBlock", () => {
  test("should insert cursor and editable region tokens correctly", () => {
    const content = `line 0
line 1
line 2
line 3
line 4`;
    const windowStart = 0;
    const windowEnd = 4;
    const cursorPosition: Position = { line: 2, character: 4 };
    const editableRegionStartLine = 1;
    const editableRegionEndLine = 3;

    const result = currentFileContentBlock(
      content,
      windowStart,
      windowEnd,
      editableRegionStartLine,
      editableRegionEndLine,
      cursorPosition,
    );

    const expected = `line 0
<|editable_region_start|>
line 1
line<|user_cursor_is_here|> 2
line 3
<|editable_region_end|>
line 4`;

    expect(result).toBe(expected);
  });

  test("should handle cursor at beginning of line", () => {
    const content = `line 0
line 1
line 2`;
    const windowStart = 0;
    const windowEnd = 2;
    const cursorPosition: Position = { line: 1, character: 0 };
    const editableRegionStartLine = 0;
    const editableRegionEndLine = 2;

    const result = currentFileContentBlock(
      content,
      windowStart,
      windowEnd,
      editableRegionStartLine,
      editableRegionEndLine,
      cursorPosition,
    );

    const expected = `<|editable_region_start|>
line 0
<|user_cursor_is_here|>line 1
line 2
<|editable_region_end|>`;

    expect(result).toBe(expected);
  });

  test("should handle cursor at end of line", () => {
    const content = `line 0
line 1
line 2`;
    const windowStart = 0;
    const windowEnd = 2;
    const cursorPosition: Position = { line: 1, character: 6 }; // end of "line 1"
    const editableRegionStartLine = 0;
    const editableRegionEndLine = 2;

    const result = currentFileContentBlock(
      content,
      windowStart,
      windowEnd,
      editableRegionStartLine,
      editableRegionEndLine,
      cursorPosition,
    );

    const expected = `<|editable_region_start|>
line 0
line 1<|user_cursor_is_here|>
line 2
<|editable_region_end|>`;

    expect(result).toBe(expected);
  });

  test("should handle single line editable region", () => {
    const content = `line 0
line 1
line 2`;
    const windowStart = 0;
    const windowEnd = 2;
    const cursorPosition: Position = { line: 1, character: 2 };
    const editableRegionStartLine = 1;
    const editableRegionEndLine = 1;

    const result = currentFileContentBlock(
      content,
      windowStart,
      windowEnd,
      editableRegionStartLine,
      editableRegionEndLine,
      cursorPosition,
    );

    const expected = `line 0
<|editable_region_start|>
li<|user_cursor_is_here|>ne 1
<|editable_region_end|>
line 2`;

    expect(result).toBe(expected);
  });

  test("should handle cursor outside bounds gracefully (this shouldn't happen)", () => {
    const content = `line 0
line 1`;
    const windowStart = 0;
    const windowEnd = 1;
    const cursorPosition: Position = { line: 10, character: 0 }; // out of bounds
    const editableRegionStartLine = 0;
    const editableRegionEndLine = 1;

    const result = currentFileContentBlock(
      content,
      windowStart,
      windowEnd,
      editableRegionStartLine,
      editableRegionEndLine,
      cursorPosition,
    );

    const expected = `<|editable_region_start|>
line 0
line 1
<|editable_region_end|>`;

    expect(result).toBe(expected);
  });

  test("should handle editable region covering entire file", () => {
    const content = `line 0
line 1
line 2`;
    const windowStart = 0;
    const windowEnd = 2;
    const cursorPosition: Position = { line: 1, character: 0 };
    const editableRegionStartLine = 0;
    const editableRegionEndLine = 2;

    const result = currentFileContentBlock(
      content,
      windowStart,
      windowEnd,
      editableRegionStartLine,
      editableRegionEndLine,
      cursorPosition,
    );

    const expected = `<|editable_region_start|>
line 0
<|user_cursor_is_here|>line 1
line 2
<|editable_region_end|>`;

    expect(result).toBe(expected);
  });

  test("should handle windowing - content outside window not included", () => {
    const content = `line 0
line 1
line 2
line 3
line 4`;
    const windowStart = 1;
    const windowEnd = 3;
    const cursorPosition: Position = { line: 2, character: 2 };
    const editableRegionStartLine = 2;
    const editableRegionEndLine = 2;

    const result = currentFileContentBlock(
      content,
      windowStart,
      windowEnd,
      editableRegionStartLine,
      editableRegionEndLine,
      cursorPosition,
    );

    const expected = `line 1
<|editable_region_start|>
li<|user_cursor_is_here|>ne 2
<|editable_region_end|>
line 3`;

    expect(result).toBe(expected);
  });
});

describe("editHistoryBlock", () => {
  test("should format empty edit history", () => {
    const result = editHistoryBlock([]);
    expect(result).toBe("");
  });

  test("should format single diff history entry", () => {
    const diff = `Index: test.js
===================================================================
--- a/test.js	2023-01-01 10:00:00.000000000 +0000
+++ b/test.js	2023-01-01 10:01:00.000000000 +0000
@@ -1,3 +1,3 @@
 function test() {
-  console.log("old");
+  console.log("new");
 }`;

    const result = editHistoryBlock([diff]);
    const expected = `User edited file "test.js"

\`\`\`diff
@@ -1,3 +1,3 @@
 function test() {
-  console.log("old");
+  console.log("new");
 }
\`\`\``;

    expect(result).toBe(expected);
  });

  test("should format multiple diff history entries in unified format", () => {
    // Multiple diffs should be concatenated into a single string
    const unifiedDiff = `Index: file1.js
===================================================================
--- a/file1.js	2023-01-01 10:00:00.000000000 +0000
+++ b/file1.js	2023-01-01 10:01:00.000000000 +0000
@@ -1 +1 @@
-const old = 1;
+const new = 1;
Index: file2.js
===================================================================
--- a/file2.js	2023-01-01 10:02:00.000000000 +0000
+++ b/file2.js	2023-01-01 10:03:00.000000000 +0000
@@ -1 +1 @@
-let x = "old";
+let x = "new";`;

    const result = editHistoryBlock([unifiedDiff]);
    const expected = `User edited file "file1.js"

\`\`\`diff
@@ -1 +1 @@
-const old = 1;
+const new = 1;
\`\`\`
User edited file "file2.js"

\`\`\`diff
@@ -1 +1 @@
-let x = "old";
+let x = "new";
\`\`\``;

    expect(result).toBe(expected);
  });

  test("should format multiple diff history entries", () => {
    // Multiple diffs should be concatenated into a single string
    const unifiedDiffs = [
      `Index: file1.js
===================================================================
--- a/file1.js	2023-01-01 10:00:00.000000000 +0000
+++ b/file1.js	2023-01-01 10:01:00.000000000 +0000
@@ -1 +1 @@
-const old = 1;
+const new = 1;`,
      `Index: file2.js
===================================================================
--- a/file2.js	2023-01-01 10:02:00.000000000 +0000
+++ b/file2.js	2023-01-01 10:03:00.000000000 +0000
@@ -1 +1 @@
-let x = "old";
+let x = "new";`,
    ];

    const result = editHistoryBlock(unifiedDiffs);
    const expected = `User edited file "file1.js"

\`\`\`diff
@@ -1 +1 @@
-const old = 1;
+const new = 1;
\`\`\`
User edited file "file2.js"

\`\`\`diff
@@ -1 +1 @@
-let x = "old";
+let x = "new";
\`\`\``;

    expect(result).toBe(expected);
  });

  // Fix remaining tests to pass strings instead of arrays
  test("should handle diff with complex filename paths", () => {
    const diff = `Index: src/components/Button/Button.tsx
===================================================================
--- a/src/components/Button/Button.tsx	2023-01-01 10:00:00.000000000 +0000
+++ b/src/components/Button/Button.tsx	2023-01-01 10:01:00.000000000 +0000
@@ -1,2 +1,2 @@
-export const Button = () => <button>Old</button>;
+export const Button = () => <button>New</button>;`;

    const result = editHistoryBlock([diff]);
    const expected = `User edited file "src/components/Button/Button.tsx"

\`\`\`diff
@@ -1,2 +1,2 @@
-export const Button = () => <button>Old</button>;
+export const Button = () => <button>New</button>;
\`\`\``;

    expect(result).toBe(expected);
  });

  test("should handle diff with new file creation", () => {
    const diff = `Index: newfile.js
===================================================================
--- /dev/null	2023-01-01 10:00:00.000000000 +0000
+++ b/newfile.js	2023-01-01 10:01:00.000000000 +0000
@@ -0,0 +1,3 @@
+function newFunction() {
+  return "hello world";
+}`;

    const result = editHistoryBlock([diff]);
    const expected = `User edited file "newfile.js"

\`\`\`diff
@@ -0,0 +1,3 @@
+function newFunction() {
+  return "hello world";
+}
\`\`\``;

    expect(result).toBe(expected);
  });

  test("should handle diff with file deletion", () => {
    const diff = `Index: deletedfile.js
===================================================================
--- a/deletedfile.js	2023-01-01 10:00:00.000000000 +0000
+++ /dev/null	2023-01-01 10:01:00.000000000 +0000
@@ -1,3 +0,0 @@
-function deletedFunction() {
-  return "goodbye";
-}`;

    const result = editHistoryBlock([diff]);
    const expected = `User edited file "deletedfile.js"

\`\`\`diff
@@ -1,3 +0,0 @@
-function deletedFunction() {
-  return "goodbye";
-}
\`\`\``;

    expect(result).toBe(expected);
  });

  test("should handle minimal diff format", () => {
    const diff = `Index: simple.txt
===================================================================
@@ -1 +1 @@
-old text
+new text`;

    const result = editHistoryBlock([diff]);
    const expected = `User edited file "simple.txt"

\`\`\`diff
@@ -1 +1 @@
-old text
+new text
\`\`\``;

    expect(result).toBe(expected);
  });
});
