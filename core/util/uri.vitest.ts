import { describe, expect, it } from "vitest";
import {
  pathToUriPathSegment,
  getCleanUriPath,
  findUriInDirs,
  getUriPathBasename,
  getFileExtensionFromBasename,
  getUriFileExtension,
  getLastNUriRelativePathParts,
  joinPathsToUri,
  joinEncodedUriPathSegmentToUri,
  getShortestUniqueRelativeUriPaths,
  getLastNPathParts,
  getUriDescription,
} from "./uri";

describe("pathToUriPathSegment", () => {
  it("should convert backslashes to forward slashes", () => {
    expect(pathToUriPathSegment("\\path\\to\\folder")).toBe("path/to/folder");
    expect(pathToUriPathSegment("path\\to\\file.ts")).toBe("path/to/file.ts");
  });

  it("should remove leading slashes", () => {
    expect(pathToUriPathSegment("/path/to/folder")).toBe("path/to/folder");
    expect(pathToUriPathSegment("\\path\\to\\folder")).toBe("path/to/folder");
  });

  it("should remove trailing slashes", () => {
    expect(pathToUriPathSegment("path/to/folder/")).toBe("path/to/folder");
    expect(pathToUriPathSegment("path\\to\\folder\\")).toBe("path/to/folder");
  });

  it("should remove both leading and trailing slashes", () => {
    expect(pathToUriPathSegment("/path/to/folder/")).toBe("path/to/folder");
    expect(pathToUriPathSegment("\\path\\to\\folder\\")).toBe("path/to/folder");
  });

  it("should handle already clean paths", () => {
    expect(pathToUriPathSegment("is/already/clean")).toBe("is/already/clean");
  });

  it("should encode special characters in path segments", () => {
    expect(pathToUriPathSegment("path/to/file with space.ts")).toBe(
      "path/to/file%20with%20space.ts",
    );
    expect(pathToUriPathSegment("path/special#char")).toBe(
      "path/special%23char",
    );
  });

  it("should handle empty strings", () => {
    expect(pathToUriPathSegment("")).toBe("");
  });

  it("should handle single path segment", () => {
    expect(pathToUriPathSegment("file.ts")).toBe("file.ts");
  });

  it("should handle paths with only slashes", () => {
    expect(pathToUriPathSegment("/")).toBe("");
    expect(pathToUriPathSegment("\\")).toBe("");
  });
});

describe("getCleanUriPath", () => {
  it("should extract and clean path from URI", () => {
    expect(getCleanUriPath("file:///path/to/folder")).toBe("path/to/folder");
    expect(getCleanUriPath("file:///path/to/file.ts")).toBe("path/to/file.ts");
  });

  it("should remove leading slashes from path", () => {
    expect(getCleanUriPath("file:///folder")).toBe("folder");
  });

  it("should remove trailing slashes from path", () => {
    expect(getCleanUriPath("file:///folder/")).toBe("folder");
  });

  it("should handle URIs without paths", () => {
    expect(getCleanUriPath("file://")).toBe("");
  });

  it("should handle encoded characters", () => {
    expect(getCleanUriPath("file:///path/to/file%20name.ts")).toBe(
      "path/to/file%20name.ts",
    );
  });
});

describe("findUriInDirs", () => {
  it("should find URI within a directory", () => {
    const result = findUriInDirs("file:///workspace/src/file.ts", [
      "file:///workspace",
    ]);
    expect(result.uri).toBe("file:///workspace/src/file.ts");
    expect(result.relativePathOrBasename).toBe("src/file.ts");
    expect(result.foundInDir).toBe("file:///workspace");
  });

  it("should return basename when not found in any directory", () => {
    const result = findUriInDirs("file:///other/path/file.ts", [
      "file:///workspace",
    ]);
    expect(result.uri).toBe("file:///other/path/file.ts");
    expect(result.relativePathOrBasename).toBe("file.ts");
    expect(result.foundInDir).toBe(null);
  });

  it("should handle multiple directory candidates", () => {
    const result = findUriInDirs("file:///workspace/src/file.ts", [
      "file:///other",
      "file:///workspace",
    ]);
    expect(result.relativePathOrBasename).toBe("src/file.ts");
    expect(result.foundInDir).toBe("file:///workspace");
  });

  it("should not match partial directory names", () => {
    // file:///folder/file should not match file:///fold
    const result = findUriInDirs("file:///folder/file.ts", ["file:///fold"]);
    expect(result.foundInDir).toBe(null);
    expect(result.relativePathOrBasename).toBe("file.ts");
  });

  it("should match exact directory", () => {
    const result = findUriInDirs("file:///folder/file.ts", ["file:///folder"]);
    expect(result.foundInDir).toBe("file:///folder");
    expect(result.relativePathOrBasename).toBe("file.ts");
  });

  it("should throw error for invalid URI", () => {
    expect(() =>
      findUriInDirs("not-a-valid-uri", ["file:///workspace"]),
    ).toThrow("Invalid uri");
  });

  it("should throw error for invalid directory URI", () => {
    expect(() => findUriInDirs("file:///file.ts", ["not-a-valid-uri"])).toThrow(
      "Invalid uri",
    );
  });

  it("should not match different schemes", () => {
    const result = findUriInDirs("http:///workspace/file.ts", [
      "file:///workspace",
    ]);
    expect(result.foundInDir).toBe(null);
  });

  it("should handle empty directory candidates", () => {
    const result = findUriInDirs("file:///path/file.ts", []);
    expect(result.foundInDir).toBe(null);
    expect(result.relativePathOrBasename).toBe("file.ts");
  });

  it("should decode URI components in relative path", () => {
    const result = findUriInDirs(
      "file:///workspace/path%20with%20spaces/file.ts",
      ["file:///workspace"],
    );
    expect(result.relativePathOrBasename).toBe("path with spaces/file.ts");
  });
});

describe("getUriPathBasename", () => {
  it("should return the basename of a URI", () => {
    expect(getUriPathBasename("file:///path/to/file.ts")).toBe("file.ts");
    expect(getUriPathBasename("file:///folder/subfolder/file.txt")).toBe(
      "file.txt",
    );
  });

  it("should return folder name for folder URIs", () => {
    expect(getUriPathBasename("file:///path/to/folder")).toBe("folder");
  });

  it("should handle URIs with trailing slashes", () => {
    expect(getUriPathBasename("file:///path/to/folder/")).toBe("folder");
  });

  it("should decode URI encoded characters", () => {
    expect(getUriPathBasename("file:///path/to/file%20name.ts")).toBe(
      "file name.ts",
    );
    expect(getUriPathBasename("file:///path/file%23hash.ts")).toBe(
      "file#hash.ts",
    );
  });

  it("should handle root paths", () => {
    expect(getUriPathBasename("file:///")).toBe("");
  });

  it("should handle single segment paths", () => {
    expect(getUriPathBasename("file:///file.ts")).toBe("file.ts");
  });
});

describe("getFileExtensionFromBasename", () => {
  it("should return file extension in lowercase", () => {
    expect(getFileExtensionFromBasename("file.ts")).toBe("ts");
    expect(getFileExtensionFromBasename("file.TS")).toBe("ts");
    expect(getFileExtensionFromBasename("file.TypeScript")).toBe("typescript");
  });

  it("should return the last extension for multiple dots", () => {
    expect(getFileExtensionFromBasename("file.test.ts")).toBe("ts");
    expect(getFileExtensionFromBasename("file.spec.js")).toBe("js");
  });

  it("should return empty string for files without extension", () => {
    expect(getFileExtensionFromBasename("Dockerfile")).toBe("");
    expect(getFileExtensionFromBasename("README")).toBe("");
  });

  it("should handle dotfiles", () => {
    expect(getFileExtensionFromBasename(".gitignore")).toBe("gitignore");
    expect(getFileExtensionFromBasename(".env")).toBe("env");
  });

  it("should handle empty strings", () => {
    expect(getFileExtensionFromBasename("")).toBe("");
  });
});

describe("getUriFileExtension", () => {
  it("should return file extension from URI", () => {
    expect(getUriFileExtension("file:///path/to/file.ts")).toBe("ts");
    expect(getUriFileExtension("file:///path/to/file.JS")).toBe("js");
  });

  it("should handle multiple dots in filename", () => {
    expect(getUriFileExtension("file:///path/to/file.test.ts")).toBe("ts");
  });

  it("should return empty string for no extension", () => {
    expect(getUriFileExtension("file:///path/to/Dockerfile")).toBe("");
  });

  it("should handle encoded characters", () => {
    expect(getUriFileExtension("file:///path/file%20name.ts")).toBe("ts");
  });
});

describe("getLastNUriRelativePathParts", () => {
  it("should return last N parts of relative path", () => {
    expect(
      getLastNUriRelativePathParts(
        ["file:///workspace"],
        "file:///workspace/src/components/Button.tsx",
        2,
      ),
    ).toBe("components/Button.tsx");
  });

  it("should return full relative path if N exceeds available parts", () => {
    expect(
      getLastNUriRelativePathParts(
        ["file:///workspace"],
        "file:///workspace/file.ts",
        5,
      ),
    ).toBe("file.ts");
  });

  it("should return empty string for N = 0", () => {
    expect(
      getLastNUriRelativePathParts(
        ["file:///workspace"],
        "file:///workspace/src/file.ts",
        0,
      ),
    ).toBe("");
  });

  it("should handle basename when not found in directories", () => {
    expect(
      getLastNUriRelativePathParts(
        ["file:///other"],
        "file:///workspace/src/file.ts",
        2,
      ),
    ).toBe("file.ts");
  });
});

describe("joinPathsToUri", () => {
  it("should join path segments to URI", () => {
    expect(joinPathsToUri("file:///workspace", "src", "file.ts")).toBe(
      "file:///workspace/src/file.ts",
    );
  });

  it("should handle URI with trailing slash", () => {
    expect(joinPathsToUri("file:///workspace/", "src", "file.ts")).toBe(
      "file:///workspace/src/file.ts",
    );
  });

  it("should handle path segments with leading slashes", () => {
    expect(joinPathsToUri("file:///workspace", "/src", "file.ts")).toBe(
      "file:///workspace/src/file.ts",
    );
  });

  it("should encode special characters", () => {
    expect(joinPathsToUri("file:///workspace", "path with space")).toBe(
      "file:///workspace/path%20with%20space",
    );
  });

  it("should handle single path segment", () => {
    expect(joinPathsToUri("file:///workspace", "file.ts")).toBe(
      "file:///workspace/file.ts",
    );
  });

  it("should handle empty path segments", () => {
    expect(joinPathsToUri("file:///workspace")).toBe("file:///workspace/");
  });
});

describe("joinEncodedUriPathSegmentToUri", () => {
  it("should join already encoded path segment to URI", () => {
    expect(
      joinEncodedUriPathSegmentToUri("file:///workspace", "path%20segment"),
    ).toBe("file:///workspace/path%20segment");
  });

  it("should handle URI with trailing slash", () => {
    expect(
      joinEncodedUriPathSegmentToUri("file:///workspace/", "file.ts"),
    ).toBe("file:///workspace/file.ts");
  });

  it("should handle URI without trailing slash", () => {
    expect(joinEncodedUriPathSegmentToUri("file:///workspace", "file.ts")).toBe(
      "file:///workspace/file.ts",
    );
  });
});

describe("getShortestUniqueRelativeUriPaths", () => {
  it("should return shortest unique paths for unique basenames", () => {
    const result = getShortestUniqueRelativeUriPaths(
      [
        "file:///workspace/src/file1.ts",
        "file:///workspace/src/file2.ts",
        "file:///workspace/src/file3.ts",
      ],
      ["file:///workspace"],
    );

    expect(result).toHaveLength(3);
    expect(result[0].uniquePath).toBe("file1.ts");
    expect(result[1].uniquePath).toBe("file2.ts");
    expect(result[2].uniquePath).toBe("file3.ts");
  });

  it("should include more path parts when basenames collide", () => {
    const result = getShortestUniqueRelativeUriPaths(
      [
        "file:///workspace/src/components/Button.tsx",
        "file:///workspace/src/utils/Button.tsx",
      ],
      ["file:///workspace"],
    );

    expect(result).toHaveLength(2);
    expect(result[0].uniquePath).toBe("components/Button.tsx");
    expect(result[1].uniquePath).toBe("utils/Button.tsx");
  });

  it("should handle identical paths", () => {
    const result = getShortestUniqueRelativeUriPaths(
      ["file:///workspace/src/file.ts", "file:///workspace/src/file.ts"],
      ["file:///workspace"],
    );

    expect(result).toHaveLength(2);
    // Both should fall back to full relative path
    expect(result[0].uniquePath).toBe("src/file.ts");
    expect(result[1].uniquePath).toBe("src/file.ts");
  });

  it("should handle single URI", () => {
    const result = getShortestUniqueRelativeUriPaths(
      ["file:///workspace/src/file.ts"],
      ["file:///workspace"],
    );

    expect(result).toHaveLength(1);
    expect(result[0].uniquePath).toBe("file.ts");
  });

  it("should handle empty input", () => {
    const result = getShortestUniqueRelativeUriPaths([], ["file:///workspace"]);
    expect(result).toHaveLength(0);
  });

  it("should handle deeply nested collisions", () => {
    const result = getShortestUniqueRelativeUriPaths(
      [
        "file:///workspace/packages/a/src/index.ts",
        "file:///workspace/packages/b/src/index.ts",
      ],
      ["file:///workspace"],
    );

    expect(result).toHaveLength(2);
    // Need enough context to distinguish them
    expect(result[0].uniquePath).toBe("a/src/index.ts");
    expect(result[1].uniquePath).toBe("b/src/index.ts");
  });
});

describe("getLastNPathParts", () => {
  it("should return last N parts of a path", () => {
    expect(getLastNPathParts("path/to/folder/file.ts", 2)).toBe(
      "folder/file.ts",
    );
    expect(getLastNPathParts("path/to/folder/file.ts", 1)).toBe("file.ts");
    expect(getLastNPathParts("path/to/folder/file.ts", 3)).toBe(
      "to/folder/file.ts",
    );
  });

  it("should handle backslashes", () => {
    expect(getLastNPathParts("path\\to\\folder\\file.ts", 2)).toBe(
      "folder/file.ts",
    );
  });

  it("should return empty string for N = 0", () => {
    expect(getLastNPathParts("path/to/file.ts", 0)).toBe("");
  });

  it("should return empty string for negative N", () => {
    expect(getLastNPathParts("path/to/file.ts", -1)).toBe("");
  });

  it("should return full path if N exceeds parts count", () => {
    expect(getLastNPathParts("path/file.ts", 5)).toBe("path/file.ts");
  });

  it("should handle single part path", () => {
    expect(getLastNPathParts("file.ts", 1)).toBe("file.ts");
    expect(getLastNPathParts("file.ts", 2)).toBe("file.ts");
  });

  it("should handle empty path", () => {
    expect(getLastNPathParts("", 1)).toBe("");
  });
});

describe("getUriDescription", () => {
  it("should return full URI description", () => {
    const result = getUriDescription("file:///workspace/src/utils/helper.ts", [
      "file:///workspace",
    ]);

    expect(result.uri).toBe("file:///workspace/src/utils/helper.ts");
    expect(result.relativePathOrBasename).toBe("src/utils/helper.ts");
    expect(result.foundInDir).toBe("file:///workspace");
    expect(result.baseName).toBe("helper.ts");
    expect(result.extension).toBe("ts");
    expect(result.last2Parts).toBe("utils/helper.ts");
  });

  it("should handle URI not in any directory", () => {
    const result = getUriDescription("file:///other/path/file.ts", [
      "file:///workspace",
    ]);

    expect(result.foundInDir).toBe(null);
    expect(result.relativePathOrBasename).toBe("file.ts");
    expect(result.baseName).toBe("file.ts");
    expect(result.extension).toBe("ts");
  });

  it("should handle files without extensions", () => {
    const result = getUriDescription("file:///workspace/Dockerfile", [
      "file:///workspace",
    ]);

    expect(result.baseName).toBe("Dockerfile");
    expect(result.extension).toBe("");
  });

  it("should handle deeply nested files", () => {
    const result = getUriDescription("file:///workspace/a/b/c/d/e/file.ts", [
      "file:///workspace",
    ]);

    expect(result.relativePathOrBasename).toBe("a/b/c/d/e/file.ts");
    expect(result.last2Parts).toBe("e/file.ts");
    expect(result.baseName).toBe("file.ts");
  });
});
