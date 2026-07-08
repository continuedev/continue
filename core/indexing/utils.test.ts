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

test("tagToString truncates beginning of directory when path is too long and adds hash for uniqueness", () => {
  const longPrefix = "/very/long/path/that/will/be/truncated/";
  const importantSuffix = "/user/important-project/src/feature";
  const longPath = longPrefix + "x".repeat(200) + importantSuffix;

  const tag: IndexTag = {
    directory: longPath,
    branch: "feature-branch",
    artifactId: "67890",
  };

  const result = tagToString(tag);

  expect(result).toContain("::feature-branch::67890");
  expect(result.length).toBeLessThanOrEqual(240);
  expect(result).toMatch(/^[a-f0-9]{8}_/);
  expect(result).toContain(importantSuffix);
});

test("tagToString preserves branch and artifactId exactly, even when truncating", () => {
  const longPath = "/a".repeat(300);
  const tag: IndexTag = {
    directory: longPath,
    branch: "release-v2.0",
    artifactId: "build-123",
  };

  const result = tagToString(tag);

  expect(result).toContain("::release-v2.0::build-123");
  expect(result).toMatch(/^[a-f0-9]{8}_/);
  expect(result.length).toBeLessThanOrEqual(240);
});

test("tagToString ensures uniqueness for different long paths that would otherwise collide", () => {
  const basePath = "/very/long/base/path/that/exceeds/limits/";
  const commonSuffix = "/same/ending/path";

  const tag1: IndexTag = {
    directory: basePath + "different1" + "x".repeat(100) + commonSuffix,
    branch: "main",
    artifactId: "12345",
  };

  const tag2: IndexTag = {
    directory: basePath + "different2" + "y".repeat(100) + commonSuffix,
    branch: "main",
    artifactId: "12345",
  };

  const fullString1 = `${tag1.directory}::${tag1.branch}::${tag1.artifactId}`;
  const fullString2 = `${tag2.directory}::${tag2.branch}::${tag2.artifactId}`;

  const result1 = tagToString(tag1);
  const result2 = tagToString(tag2);

  expect(result1).not.toBe(result2);
  expect(result1.length).toBeLessThanOrEqual(240);
  expect(result2.length).toBeLessThanOrEqual(240);

  if (fullString1.length > 240) {
    expect(result1).toMatch(/^[a-f0-9]{8}_/);
    expect(result2).toMatch(/^[a-f0-9]{8}_/);
  } else {
    expect(result1).toBe(fullString1);
    expect(result2).toBe(fullString2);
  }
});

test("tagToString produces consistent results for the same input", () => {
  const tag: IndexTag = {
    directory:
      "/some/very/long/path/that/exceeds/the/maximum/length/limit/for/directory/names/in/the/system",
    branch: "develop",
    artifactId: "test-123",
  };

  const result1 = tagToString(tag);
  const result2 = tagToString(tag);

  expect(result1).toBe(result2);
});
