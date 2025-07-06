import {
  unifiedLazyEdit,
  analyzeLazyEditFile,
  strategies,
} from "./unified-lazy-edit";
import { dedent } from "../../util";

// Test strategy selection for different file types
test("should select markdown strategy for markdown files", async () => {
  const oldFile = dedent`
    # Documentation
    ## Installation
    Install the app.
    ## Usage
    Use the app.
  `;

  const newFile = dedent`
    # Documentation
    ## Installation
    Install the app.
    ## Configuration
    Configure the app settings.
    ## Usage
    Use the app.
  `;
  const analysis = await analyzeLazyEditFile(oldFile, newFile, "docs.md");

  expect(analysis.fileType).toBe("markdown");

  expect(analysis.recommendedStrategy).toBe("markdown_aware");
});

// Test strategy selection for test files
test("should select test strategy for test files", async () => {
  const oldFile = dedent`
    describe('Calculator', () => {
      test('should add numbers', () => {
        expect(add(2, 3)).toBe(5);
      });
    });
  `;

  const newFile = dedent`
    describe('Calculator', () => {
      test('should add numbers', () => {
        expect(add(2, 3)).toBe(5);
      });
      
      test('should subtract numbers', () => {
        expect(subtract(5, 3)).toBe(2);
      });
    });
  `;
  const analysis = await analyzeLazyEditFile(
    oldFile,
    newFile,
    "calculator.test.js",
  );
  expect(analysis.fileType).toBe("test_file");
  expect(analysis.recommendedStrategy).toBe("test_aware");
});

// Test file type detection
test("should correctly detect various file types", async () => {
  const testCases = [
    { filename: "test.js", expectedType: "javascript" },
    { filename: "component.tsx", expectedType: "javascript" },
    { filename: "README.md", expectedType: "markdown" },
    { filename: "calculator.test.js", expectedType: "test_file" },
    { filename: "__tests__/utils.js", expectedType: "test_file" },
    { filename: "unknown.xyz", expectedType: "other" },
  ];

  const simpleContent = "const x = 1;";

  for (const testCase of testCases) {
    const analysis = await analyzeLazyEditFile(
      simpleContent,
      simpleContent,
      testCase.filename,
    );
    expect(analysis.fileType).toBe(testCase.expectedType);
  }
});

// Test edge cases
test("should handle empty files gracefully", async () => {
  const diff = await unifiedLazyEdit({
    oldFile: "",
    newLazyFile: "# New Content",
    filename: "empty.md",
  });

  expect(diff).toBeDefined();
  const addedLines = diff?.filter((line) => line.type === "new") || [];
  expect(addedLines.some((line) => line.line.includes("# New Content"))).toBe(
    true,
  );
});

test("should handle identical files", async () => {
  const content = "const same = true;";

  const diff = await unifiedLazyEdit({
    oldFile: content,
    newLazyFile: content,
    filename: "same.js",
  });

  expect(diff).toBeDefined();
  expect(diff?.every((line) => line.type === "same")).toBe(true);
});
