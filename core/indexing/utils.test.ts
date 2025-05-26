import { IndexTag } from "..";
import { tagToString } from "./utils";

test("tagToString returns full tag string when under length limit", () => {
  const tag: IndexTag = {
    directory: "/normal/path/to/repo",
    branch: "main",
    artifactId: "12345",
  };

  expect(tagToString(tag)).toBe("/normal/path/to/repo::main::12345");
});

test("tagToString truncates beginning of directory when path is too long", () => {
  // Create a very long directory path that exceeds MAX_DIR_LENGTH (200)
  const longPrefix = "/very/long/path/that/will/be/truncated/";
  const importantSuffix = "/user/important-project/src/feature";
  const longPath = longPrefix + "x".repeat(200) + importantSuffix;

  const tag: IndexTag = {
    directory: longPath,
    branch: "feature-branch",
    artifactId: "67890",
  };

  const result = tagToString(tag);

  // The result should keep the important suffix part
  expect(result).toContain(importantSuffix);
  // The result should NOT contain the beginning of the path
  expect(result).not.toContain(longPrefix);
  // The result should include the branch and artifactId
  expect(result).toContain("::feature-branch::67890");
  // The result should be within the MAX_TABLE_NAME_LENGTH limit (240)
  expect(result.length).toBeLessThanOrEqual(240);
});

test("tagToString preserves branch and artifactId exactly, even when truncating", () => {
  const longPath = "/a".repeat(300); // Much longer than MAX_DIR_LENGTH
  const tag: IndexTag = {
    directory: longPath,
    branch: "release-v2.0",
    artifactId: "build-123",
  };

  const result = tagToString(tag);

  // Should contain the exact branch and artifactId
  expect(result).toContain("::release-v2.0::build-123");
  // Should contain the end of the path
  expect(result).toContain("/a/a/a");
  // Should not contain the full original path (it should be truncated)
  expect(result.length).toBeLessThan(
    longPath.length + "::release-v2.0::build-123".length,
  );
  // The result should be within the MAX_TABLE_NAME_LENGTH limit
  expect(result.length).toBeLessThanOrEqual(240);
});
