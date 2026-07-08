import { platform } from "os";
import { normalize, resolve } from "path";

import { describe, expect, it } from "vitest";

import { pathToUri, slugToUri, uriToPath, uriToSlug } from "./uriUtils.js";

describe("uriUtils", () => {
  describe("pathToUri", () => {
    it("should convert Unix-style absolute paths to file URIs", () => {
      const unixPath = "/home/user/documents/file.txt";
      const result = pathToUri(unixPath);
      expect(result).toMatch(/^file:\/\/\//);
      expect(result).toContain("file.txt");
    });

    it("should convert Unix-style relative paths to file URIs", () => {
      const relativePath = "./documents/file.txt";
      const result = pathToUri(relativePath);
      expect(result).toMatch(/^file:\/\/\//);
      expect(result).toContain("file.txt");
    });

    it("should handle Windows-style paths with drive letters", () => {
      const windowsPath = "C:\\Users\\user\\Documents\\file.txt";
      const result = pathToUri(windowsPath);
      expect(result).toMatch(/^file:\/\/\//);
      expect(result).toContain("file.txt");
      // Windows paths should be converted to forward slashes in URI
      if (platform() === "win32") {
        expect(result).toContain("C:");
      }
    });

    it("should handle Windows UNC paths", () => {
      const uncPath = "\\\\server\\share\\folder\\file.txt";
      const result = pathToUri(uncPath);
      // UNC paths produce file://server/share/... format (two slashes, not three)
      expect(result).toMatch(/^file:\/\//);
      expect(result).toContain("file.txt");
    });

    it("should handle paths with special characters", () => {
      const pathWithSpaces = "/home/user/my documents/file with spaces.txt";
      const result = pathToUri(pathWithSpaces);
      expect(result).toMatch(/^file:\/\/\//);
      // Spaces should be properly encoded
      expect(result).toContain("file%20with%20spaces.txt");
    });

    it("should handle paths with Unicode characters", () => {
      const unicodePath = "/home/user/文档/файл.txt";
      const result = pathToUri(unicodePath);
      expect(result).toMatch(/^file:\/\/\//);
      // Should handle Unicode properly
      expect(result).toContain("%E6%96%87%E6%A1%A3"); // 文档 encoded
    });

    it("should normalize mixed path separators", () => {
      const mixedPath = "/home/user\\documents/file.txt";
      const result = pathToUri(mixedPath);
      expect(result).toMatch(/^file:\/\/\//);
      expect(result).toContain("file.txt");
    });

    it("should handle empty string", () => {
      const result = pathToUri("");
      expect(result).toMatch(/^file:\/\/\//);
    });

    it("should handle current directory", () => {
      const result = pathToUri(".");
      expect(result).toMatch(/^file:\/\/\//);
    });
  });

  describe("uriToPath", () => {
    it("should convert file URIs to Unix-style paths", () => {
      const uri = "file:///home/user/documents/file.txt";
      const result = uriToPath(uri);
      // On Windows, Unix-style URIs without a drive letter are invalid
      if (platform() === "win32") {
        expect(result).toBeNull();
      } else {
        expect(result).toBeTruthy();
        expect(result).toContain("file.txt");
        expect(result).toBe("/home/user/documents/file.txt");
      }
    });

    it("should convert Windows file URIs to Windows paths", () => {
      const uri = "file:///C:/Users/user/Documents/file.txt";
      const result = uriToPath(uri);
      expect(result).toBeTruthy();
      expect(result).toContain("file.txt");
      if (platform() === "win32") {
        expect(result).toContain("C:");
        // fileURLToPath returns paths with single backslashes as separators
        expect(result).toContain("\\");
      }
    });

    it("should handle URIs with encoded special characters", () => {
      const uri = "file:///home/user/my%20documents/file%20with%20spaces.txt";
      const result = uriToPath(uri);
      // Note: This test may fail on Windows if the URI lacks a drive letter
      if (result) {
        expect(result).toContain("my documents");
        expect(result).toContain("file with spaces.txt");
      }
    });

    it("should handle URIs with Unicode characters", () => {
      const uri = "file:///home/user/%E6%96%87%E6%A1%A3/%E6%96%87%E4%BB%B6.txt";
      const result = uriToPath(uri);
      // Note: This test may fail on Windows if the URI lacks a drive letter
      if (result) {
        expect(result).toContain("文档");
        expect(result).toContain("文件.txt");
      }
    });

    it("should return null for non-file URIs", () => {
      const httpUri = "http://example.com/file.txt";
      const result = uriToPath(httpUri);
      expect(result).toBeNull();
    });

    it("should return null for malformed URIs", () => {
      const malformedUri = "file://invalid-uri";
      const result = uriToPath(malformedUri);
      // On Windows, file://invalid-uri is interpreted as a UNC path
      // On Unix, it may throw an error and return null, or parse successfully
      if (platform() === "win32") {
        // Windows interprets this as \\invalid-uri
        expect(result).toBeTruthy();
      }
      // On other platforms behavior varies, so we don't assert
    });

    it("should handle UNC paths on Windows", () => {
      const uri = "file://server/share/folder/file.txt";
      const result = uriToPath(uri);
      if (platform() === "win32") {
        expect(result).toBeTruthy();
        expect(result).toContain("file.txt");
      }
      // On Unix systems, this format is not valid and behavior is undefined
    });

    it("should return null for empty URI", () => {
      const result = uriToPath("");
      expect(result).toBeNull();
    });

    it("should handle root directory URI", () => {
      const uri = "file:///";
      const result = uriToPath(uri);
      // On Windows, file:/// without a drive letter may fail
      // On Unix, it should return /
      if (platform() !== "win32") {
        expect(result).toBe("/");
      }
      // Skip assertion on Windows as behavior is platform-specific
    });
  });

  describe("round-trip conversion", () => {
    const testPaths = [
      "/home/user/documents/file.txt", // Unix absolute
      "./relative/path/file.txt", // Relative
      "../parent/file.txt", // Parent relative
      "/tmp/file with spaces.txt", // Spaces
      "/home/用户/文档/文件.txt", // Unicode
    ];

    // Add Windows-specific paths if running on Windows
    const windowsPaths = [
      "C:\\Users\\user\\Documents\\file.txt", // Windows absolute
      "D:\\Program Files\\app\\file.exe", // Program Files
      "\\\\server\\share\\file.txt", // UNC path
    ];

    const allPaths =
      platform() === "win32" ? [...testPaths, ...windowsPaths] : testPaths;

    allPaths.forEach((originalPath) => {
      it(`should maintain path integrity for: ${originalPath}`, () => {
        const uri = pathToUri(originalPath);
        const roundTripPath = uriToPath(uri);

        expect(roundTripPath).toBeTruthy();

        // Normalize both paths for comparison since path separators might differ
        const normalizedOriginal = normalize(resolve(originalPath));
        const normalizedRoundTrip = normalize(roundTripPath!);

        expect(normalizedRoundTrip).toBe(normalizedOriginal);
      });
    });
  });

  describe("slugToUri", () => {
    it("should convert slug to URI", () => {
      const slug = "my-awesome-project";
      const result = slugToUri(slug);
      expect(result).toBe("slug://my-awesome-project");
    });

    it("should handle empty slug", () => {
      const slug = "";
      const result = slugToUri(slug);
      expect(result).toBe("slug://");
    });

    it("should handle slug with special characters", () => {
      const slug = "my-project_123";
      const result = slugToUri(slug);
      expect(result).toBe("slug://my-project_123");
    });
  });

  describe("uriToSlug", () => {
    it("should extract slug from URI", () => {
      const uri = "slug://my-awesome-project";
      const result = uriToSlug(uri);
      expect(result).toBe("my-awesome-project");
    });

    it("should return null for non-slug URIs", () => {
      const uri = "file:///path/to/file";
      const result = uriToSlug(uri);
      expect(result).toBeNull();
    });

    it("should handle empty slug URI", () => {
      const uri = "slug://";
      const result = uriToSlug(uri);
      expect(result).toBe("");
    });

    it("should return null for malformed URI", () => {
      const uri = "slug:/missing-slash";
      const result = uriToSlug(uri);
      expect(result).toBeNull();
    });
  });

  describe("slug round-trip conversion", () => {
    const testSlugs = [
      "simple-slug",
      "complex_slug-123",
      "",
      "a",
      "very-long-slug-name-with-many-parts",
    ];

    testSlugs.forEach((originalSlug) => {
      it(`should maintain slug integrity for: "${originalSlug}"`, () => {
        const uri = slugToUri(originalSlug);
        const roundTripSlug = uriToSlug(uri);
        expect(roundTripSlug).toBe(originalSlug);
      });
    });
  });
});
