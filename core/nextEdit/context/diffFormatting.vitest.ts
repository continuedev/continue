import { describe, expect, it } from "vitest";
import {
  BeforeAfterDiff,
  createBeforeAfterDiff,
  createDiff,
  CreateDiffArgs,
  DiffFormatType,
  DiffMetadata,
  extractMetadataFromUnifiedDiff,
} from "./diffFormatting";

describe("diffFormatting", () => {
  const sampleFilePath = "test/sample.js";
  const beforeContent = "const a = 1;\nconst b = 2;";
  const afterContent = "const a = 1;\nconst b = 3;\nconst c = 4;";

  describe("createDiff", () => {
    it("should create unified diff when specified", () => {
      const args: CreateDiffArgs = {
        beforeContent,
        afterContent,
        filePath: sampleFilePath,
        diffType: DiffFormatType.Unified,
        contextLines: 3,
      };

      const result = createDiff(args);

      expect(result).toContain("---");
      expect(result).toContain("+++");
      expect(result).toContain("@@");
      expect(result).toContain("-const b = 2;");
      expect(result).toContain("+const b = 3;");
      expect(result).toContain("+const c = 4;");
    });

    it("should create token line diff when specified", () => {
      const args: CreateDiffArgs = {
        beforeContent,
        afterContent,
        filePath: sampleFilePath,
        diffType: DiffFormatType.TokenLineDiff,
        contextLines: 3,
      };

      const result = createDiff(args);

      // Currently returns empty string as TODO
      expect(result).toBe("");
    });

    it("should return empty string for unsupported diff types", () => {
      const args: CreateDiffArgs = {
        beforeContent,
        afterContent,
        filePath: sampleFilePath,
        diffType: DiffFormatType.RawBeforeAfter,
        contextLines: 3,
      };

      const result = createDiff(args);

      expect(result).toBe("");
    });

    it("should handle empty content", () => {
      const args: CreateDiffArgs = {
        beforeContent: "",
        afterContent: "new content",
        filePath: sampleFilePath,
        diffType: DiffFormatType.Unified,
        contextLines: 3,
      };

      const result = createDiff(args);

      expect(result).toContain("+++");
      expect(result).toContain("+new content");
    });

    it("should handle deletion", () => {
      const args: CreateDiffArgs = {
        beforeContent: "old content",
        afterContent: "",
        filePath: sampleFilePath,
        diffType: DiffFormatType.Unified,
        contextLines: 3,
      };

      const result = createDiff(args);

      expect(result).toContain("---");
      expect(result).toContain("-old content");
    });

    it("should handle content without newlines", () => {
      const args: CreateDiffArgs = {
        beforeContent: "line1",
        afterContent: "line2",
        filePath: sampleFilePath,
        diffType: DiffFormatType.Unified,
        contextLines: 3,
      };

      const result = createDiff(args);

      expect(result).toContain("-line1");
      expect(result).toContain("+line2");
    });

    it("should respect contextLines parameter", () => {
      const multiLineContent = Array(10)
        .fill("line")
        .map((l, i) => `${l}${i}`)
        .join("\n");
      const modifiedContent = multiLineContent.replace("line5", "modified5");

      const args: CreateDiffArgs = {
        beforeContent: multiLineContent,
        afterContent: modifiedContent,
        filePath: sampleFilePath,
        diffType: DiffFormatType.Unified,
        contextLines: 2,
      };

      const result = createDiff(args);

      expect(result).toContain("@@ -4,5 +4,5 @@");
    });

    it("should use relative path when workspaceDir is provided", () => {
      const args: CreateDiffArgs = {
        beforeContent,
        afterContent,
        filePath: "file:///workspace/project/src/test.js",
        diffType: DiffFormatType.Unified,
        contextLines: 3,
        workspaceDir: "file:///workspace/project",
      };

      const result = createDiff(args);

      expect(result).toContain("--- src/test.js");
      expect(result).toContain("+++ src/test.js");
      expect(result).not.toContain("file://");
      expect(result).not.toContain("/workspace/project");
    });

    it("should handle workspaceDir with trailing slash", () => {
      const args: CreateDiffArgs = {
        beforeContent,
        afterContent,
        filePath: "file:///workspace/project/src/test.js",
        diffType: DiffFormatType.Unified,
        contextLines: 3,
        workspaceDir: "file:///workspace/project/",
      };

      const result = createDiff(args);

      expect(result).toContain("--- src/test.js");
      expect(result).toContain("+++ src/test.js");
    });

    it("should fallback to basename when path not in workspace", () => {
      const args: CreateDiffArgs = {
        beforeContent,
        afterContent,
        filePath: "file:///other/location/test.js",
        diffType: DiffFormatType.Unified,
        contextLines: 3,
        workspaceDir: "file:///workspace/project",
      };

      const result = createDiff(args);

      expect(result).toContain("--- test.js");
      expect(result).toContain("+++ test.js");
    });

    it("should use full path when no workspaceDir provided", () => {
      const fullPath = "file:///workspace/project/src/test.js";
      const args: CreateDiffArgs = {
        beforeContent,
        afterContent,
        filePath: fullPath,
        diffType: DiffFormatType.Unified,
        contextLines: 3,
      };

      const result = createDiff(args);

      expect(result).toContain(`--- ${fullPath}`);
      expect(result).toContain(`+++ ${fullPath}`);
    });
  });

  describe("createBeforeAfterDiff", () => {
    it("should return BeforeAfterDiff with normalized content", () => {
      const result: BeforeAfterDiff = createBeforeAfterDiff(
        beforeContent,
        afterContent,
        sampleFilePath,
      );

      expect(result).toEqual({
        filePath: sampleFilePath,
        beforeContent: beforeContent + "\n",
        afterContent: afterContent + "\n",
      });
    });

    it("should not add extra newline if content already ends with one", () => {
      const contentWithNewline = "const a = 1;\n";
      const result: BeforeAfterDiff = createBeforeAfterDiff(
        contentWithNewline,
        contentWithNewline,
        sampleFilePath,
      );

      expect(result.beforeContent).toBe(contentWithNewline);
      expect(result.afterContent).toBe(contentWithNewline);
    });

    it("should handle empty content", () => {
      const result: BeforeAfterDiff = createBeforeAfterDiff(
        "",
        "",
        sampleFilePath,
      );

      expect(result).toEqual({
        filePath: sampleFilePath,
        beforeContent: "\n",
        afterContent: "\n",
      });
    });

    it("should handle mixed newline scenarios", () => {
      const beforeWithNewline = "line1\n";
      const afterWithoutNewline = "line2";
      const result: BeforeAfterDiff = createBeforeAfterDiff(
        beforeWithNewline,
        afterWithoutNewline,
        sampleFilePath,
      );

      expect(result.beforeContent).toBe("line1\n");
      expect(result.afterContent).toBe("line2\n");
    });
  });

  describe("extractMetadataFromUnifiedDiff", () => {
    it("should extract basic file information", () => {
      const unifiedDiff = `--- a/old.js\ttimestamp1
+++ b/new.js\ttimestamp2
@@ -1,3 +1,3 @@
 line1
-line2
+modified2
 line3`;

      const metadata: DiffMetadata =
        extractMetadataFromUnifiedDiff(unifiedDiff);

      expect(metadata.oldFilename).toBe("old.js");
      expect(metadata.newFilename).toBe("new.js");
      expect(metadata.oldTimestamp).toBe("timestamp1");
      expect(metadata.newTimestamp).toBe("timestamp2");
      expect(metadata.isNew).toBeFalsy();
      expect(metadata.isDeleted).toBeFalsy();
      expect(metadata.isRename).toBeTruthy();
    });

    it("should detect new files", () => {
      const unifiedDiff = `--- /dev/null
+++ b/new.js
@@ -0,0 +1,2 @@
+line1
+line2`;

      const metadata: DiffMetadata =
        extractMetadataFromUnifiedDiff(unifiedDiff);

      expect(metadata.oldFilename).toBe("/dev/null");
      expect(metadata.newFilename).toBe("new.js");
      expect(metadata.isNew).toBeTruthy();
      expect(metadata.isDeleted).toBeFalsy();
      expect(metadata.isRename).toBeFalsy();
    });

    it("should detect deleted files", () => {
      const unifiedDiff = `--- a/old.js
+++ /dev/null
@@ -1,2 +0,0 @@
-line1
-line2`;

      const metadata: DiffMetadata =
        extractMetadataFromUnifiedDiff(unifiedDiff);

      expect(metadata.oldFilename).toBe("old.js");
      expect(metadata.newFilename).toBe("/dev/null");
      expect(metadata.isNew).toBeFalsy();
      expect(metadata.isDeleted).toBeTruthy();
      expect(metadata.isRename).toBeFalsy();
    });

    it("should parse hunk information", () => {
      const unifiedDiff = `--- a/file.js
+++ b/file.js
@@ -1,5 +1,6 @@ function header
 line1
-line2
+modified2
+newline
 line3
@@ -10,3 +11,3 @@
 line10
-line11
+modified11
 line12`;

      const metadata: DiffMetadata =
        extractMetadataFromUnifiedDiff(unifiedDiff);

      expect(metadata.hunks).toHaveLength(2);
      expect(metadata.hunks![0]).toEqual({
        oldStart: 1,
        oldCount: 5,
        newStart: 1,
        newCount: 6,
        header: "function header",
        lines: [
          {
            content: "line1",
            newLineNumber: 1,
            oldLineNumber: 1,
            type: "context",
          },
          {
            content: "line2",
            oldLineNumber: 2,
            type: "deletion",
          },
          {
            content: "modified2",
            newLineNumber: 2,
            type: "addition",
          },
          {
            content: "newline",
            newLineNumber: 3,
            type: "addition",
          },
          {
            content: "line3",
            newLineNumber: 4,
            oldLineNumber: 3,
            type: "context",
          },
        ],
      });
      expect(metadata.hunks![1]).toEqual({
        oldStart: 10,
        oldCount: 3,
        newStart: 11,
        newCount: 3,
        header: undefined,
        lines: [
          {
            content: "line10",
            newLineNumber: 11,
            oldLineNumber: 10,
            type: "context",
          },
          {
            content: "line11",
            oldLineNumber: 11,
            type: "deletion",
          },
          {
            content: "modified11",
            newLineNumber: 12,
            type: "addition",
          },
          {
            content: "line12",
            newLineNumber: 13,
            oldLineNumber: 12,
            type: "context",
          },
        ],
      });
    });

    it("should handle single line hunks", () => {
      const unifiedDiff = `--- a/file.js
+++ b/file.js
@@ -1 +1 @@
-old
+new`;

      const metadata: DiffMetadata =
        extractMetadataFromUnifiedDiff(unifiedDiff);

      expect(metadata.hunks).toHaveLength(1);
      expect(metadata.hunks![0]).toEqual({
        oldStart: 1,
        oldCount: 1,
        newStart: 1,
        newCount: 1,
        header: undefined,
        lines: [
          {
            content: "old",
            oldLineNumber: 1,
            type: "deletion",
          },
          {
            content: "new",
            newLineNumber: 1,
            type: "addition",
          },
        ],
      });
    });

    it("should detect binary files", () => {
      const unifiedDiff = `--- a/image.png
+++ b/image.png
Binary files a/image.png and b/image.png differ`;

      const metadata: DiffMetadata =
        extractMetadataFromUnifiedDiff(unifiedDiff);

      expect(metadata.isBinary).toBeTruthy();
    });

    it("should detect git binary patches", () => {
      const unifiedDiff = `--- a/file.bin
+++ b/file.bin
GIT binary patch
delta 123
...`;

      const metadata: DiffMetadata =
        extractMetadataFromUnifiedDiff(unifiedDiff);

      expect(metadata.isBinary).toBeTruthy();
    });

    it("should handle files without a/ b/ prefixes", () => {
      const unifiedDiff = `--- old.js
+++ new.js
@@ -1,2 +1,2 @@
-line1
+modified1
 line2`;

      const metadata: DiffMetadata =
        extractMetadataFromUnifiedDiff(unifiedDiff);

      expect(metadata.oldFilename).toBe("old.js");
      expect(metadata.newFilename).toBe("new.js");
    });

    it("should handle empty diff", () => {
      const metadata: DiffMetadata = extractMetadataFromUnifiedDiff("");

      expect(metadata.oldFilename).toBeUndefined();
      expect(metadata.newFilename).toBeUndefined();
      expect(metadata.hunks).toEqual([]);
      expect(metadata.isBinary).toBeFalsy();
    });

    it("should handle malformed diff gracefully", () => {
      const malformedDiff = `not a diff
random text`;

      const metadata: DiffMetadata =
        extractMetadataFromUnifiedDiff(malformedDiff);

      expect(metadata.oldFilename).toBeUndefined();
      expect(metadata.newFilename).toBeUndefined();
      expect(metadata.hunks).toEqual([]);
    });

    it("should not consider same filenames as rename", () => {
      const unifiedDiff = `--- a/file.js
+++ b/file.js
@@ -1,2 +1,2 @@
-line1
+modified1
 line2`;

      const metadata: DiffMetadata =
        extractMetadataFromUnifiedDiff(unifiedDiff);

      expect(metadata.isRename).toBeFalsy();
    });

    it("should handle files with spaces in names", () => {
      const unifiedDiff = `--- a/my file.js\t2023-01-01 00:00:00
+++ b/my new file.js\t2023-01-01 00:01:00
@@ -1,1 +1,1 @@
-content
+new content`;

      const metadata: DiffMetadata =
        extractMetadataFromUnifiedDiff(unifiedDiff);

      expect(metadata.oldFilename).toBe("my file.js");
      expect(metadata.newFilename).toBe("my new file.js");
      expect(metadata.oldTimestamp).toBe("2023-01-01 00:00:00");
      expect(metadata.newTimestamp).toBe("2023-01-01 00:01:00");
      expect(metadata.isRename).toBeTruthy();
    });
  });

  describe("DiffFormatType enum", () => {
    it("should have correct enum values", () => {
      expect(DiffFormatType.Unified).toBe("unified");
      expect(DiffFormatType.RawBeforeAfter).toBe("beforeAfter");
      expect(DiffFormatType.TokenLineDiff).toBe("linediff");
    });
  });
});
