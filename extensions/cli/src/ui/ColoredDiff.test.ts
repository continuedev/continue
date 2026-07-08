import { render } from "ink-testing-library";
import React from "react";

import { ColoredDiff } from "./ColoredDiff.js";

describe("ColoredDiff", () => {
  it("renders simple line additions", () => {
    const diffContent = `@@ -1,3 +1,4 @@
 function hello() {
+  console.log("added line");
   return "world";
 }`;

    const { lastFrame } = render(
      React.createElement(ColoredDiff, { diffContent }),
    );
    const frame = lastFrame();

    expect(frame).toContain('console.log("added line")');
    expect(frame).toContain("+");
  });

  it("renders simple line deletions", () => {
    const diffContent = `@@ -1,4 +1,3 @@
 function hello() {
-  console.log("removed line");
   return "world";
 }`;

    const { lastFrame } = render(
      React.createElement(ColoredDiff, { diffContent }),
    );
    const frame = lastFrame();

    expect(frame).toContain('console.log("removed line")');
    expect(frame).toContain("-");
  });

  it("renders context lines", () => {
    const diffContent = `@@ -1,4 +1,4 @@
 function hello() {
-  console.log("old");
+  console.log("new");
   return "world";
 }`;

    const { lastFrame } = render(
      React.createElement(ColoredDiff, { diffContent }),
    );
    const frame = lastFrame();

    expect(frame).toContain("function hello()");
    expect(frame).toContain('return "world"');
  });

  it("renders word-level diffs for modified lines", () => {
    const diffContent = `@@ -1,3 +1,3 @@
 function hello() {
-  return "old text";
+  return "new text";
 }`;

    const { lastFrame } = render(
      React.createElement(ColoredDiff, { diffContent }),
    );
    const frame = lastFrame();

    expect(frame).toContain('return "');
    expect(frame).toContain('text"');
    // Should show both old and new versions for word-level diff
    expect(frame).toContain("-");
    expect(frame).toContain("+");
  });

  it("handles empty diff content", () => {
    const { lastFrame } = render(
      React.createElement(ColoredDiff, { diffContent: "" }),
    );
    const frame = lastFrame();

    expect(frame).toContain("No changes detected");
  });

  it("truncates long diffs", () => {
    // Create a diff with more than 16 lines
    const lines = Array.from({ length: 20 }, (_, i) => `+  line ${i + 1}`).join(
      "\n",
    );
    const diffContent = `@@ -1,1 +1,20 @@
 function hello() {
${lines}
 }`;

    const { lastFrame } = render(
      React.createElement(ColoredDiff, { diffContent }),
    );
    const frame = lastFrame();

    expect(frame).toContain("more lines");
  });

  it("handles mixed add/delete groups for word-level diffing", () => {
    const diffContent = `@@ -1,4 +1,4 @@
 function hello() {
-  const x = "old value";
-  const y = "another old";
+  const x = "new value";  
+  const y = "another new";
   return x + y;
 }`;

    const { lastFrame } = render(
      React.createElement(ColoredDiff, { diffContent }),
    );
    const frame = lastFrame();

    // Should render word-level diffs
    expect(frame).toContain('const x = "');
    expect(frame).toContain('value"');
    expect(frame).toContain('const y = "another');
  });

  it("handles single-type changes without word-level diffing", () => {
    const diffContent = `@@ -1,3 +1,4 @@
 function hello() {
+  console.log("new line 1");
+  console.log("new line 2");
   return "world";
 }`;

    const { lastFrame } = render(
      React.createElement(ColoredDiff, { diffContent }),
    );
    const frame = lastFrame();

    // Should render as normal line additions, not word-level
    expect(frame).toContain('console.log("new line 1")');
    expect(frame).toContain('console.log("new line 2")');
    expect(frame).toContain("+");
  });

  it("text content matches expected diff output ignoring styling", () => {
    const diffContent = `@@ -1,4 +1,4 @@
 function hello() {
-  return "old text";
+  return "new text";
 }`;

    const { lastFrame } = render(
      React.createElement(ColoredDiff, { diffContent }),
    );
    const frame = lastFrame();

    // Extract just the line numbers and content, ignoring colors/styling
    // The output should contain these essential elements:
    expect(frame).toContain("function hello()");
    expect(frame).toContain("- ");
    expect(frame).toContain("+ ");
    expect(frame).toContain('return "');
    expect(frame).toContain('text"');

    // Verify we have both old and new text content
    // Word-level diff splits these into separate words
    expect(frame).toContain("old");
    expect(frame).toContain("new");

    // Verify we don't have corrupted or missing content
    const lineMatches = frame?.match(/return "/g) || [];
    expect(lineMatches.length).toBeGreaterThanOrEqual(2); // Should appear in both - and + lines
  });

  it("word-level diff preserves all original content", () => {
    const diffContent = `@@ -1,3 +1,3 @@
 const x = 1;
-const y = "hello world";
+const y = "hello universe";
 const z = 3;`;

    const { lastFrame } = render(
      React.createElement(ColoredDiff, { diffContent }),
    );
    const frame = lastFrame();

    // All original text should be preserved
    expect(frame).toContain("const x = 1");
    expect(frame).toContain("const z = 3");

    // Both old and new versions should be shown
    // Word-level diff splits these into separate words
    expect(frame).toContain("hello");
    expect(frame).toContain("world");
    expect(frame).toContain("universe");
    expect(frame).toContain('const y = "');

    // Should have proper line prefixes
    expect(frame).toContain("- ");
    expect(frame).toContain("+ ");
  });

  it("complex word-level diff maintains content integrity", () => {
    const diffContent = `@@ -1,5 +1,5 @@
 function calculate() {
-  const result = oldFunction(a, b);
-  return result.value;
+  const result = newFunction(a, b, c);
+  return result.data;
 }`;

    const { lastFrame } = render(
      React.createElement(ColoredDiff, { diffContent }),
    );
    const frame = lastFrame();

    // Check that all unique content appears
    expect(frame).toContain("function calculate()");
    expect(frame).toContain("const result");
    // Word-level diff splits function calls into parts
    expect(frame).toContain("oldFunction");
    expect(frame).toContain("newFunction");
    expect(frame).toContain("(a, b)");
    expect(frame).toContain("(a, b, c)");
    expect(frame).toContain("return");
    expect(frame).toContain("result");
    expect(frame).toContain("value");
    expect(frame).toContain("data");

    // Verify structure is maintained
    expect(frame).toContain("- ");
    expect(frame).toContain("+ ");
  });
});
