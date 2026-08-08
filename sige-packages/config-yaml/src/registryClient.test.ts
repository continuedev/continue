import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "url";
import { PackageIdentifier } from "./interfaces/slugs.js";
import { RegistryClient } from "./registryClient.js";

describe("RegistryClient", () => {
  // Create a temp directory for test files
  let tempDir: string;
  beforeAll(async () => {
    // Create a temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "registry-client-test-"));
  });

  afterAll(async () => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("constructor", () => {
    it("should create client with no options", () => {
      const client = new RegistryClient();
      expect(client).toBeDefined();
    });

    it("should store the rootPath if provided", () => {
      const client = new RegistryClient({ rootPath: "/test-path" });
      expect((client as any).rootPath).toBe("/test-path");
    });
  });

  describe("getContent", () => {
    let testFilePath: string;

    beforeEach(() => {
      // Create a test file for each test
      testFilePath = path.join(tempDir, "test-file.yaml");
      fs.writeFileSync(testFilePath, "file content", "utf8");
    });

    it("should get content from file path for file uriType", async () => {
      const client = new RegistryClient();

      const id: PackageIdentifier = {
        uriType: "file",
        fileUri: testFilePath,
      };

      const result = await client.getContent(id);
      expect(result).toBe("file content");
    });

    it("should throw error for slug uriType", async () => {
      const client = new RegistryClient();

      const id: PackageIdentifier = {
        uriType: "slug",
        fullSlug: {
          ownerSlug: "owner",
          packageSlug: "package",
          versionSlug: "1.0.0",
        },
      };

      await expect(client.getContent(id)).rejects.toThrow(
        "Slug-based package resolution is not supported",
      );
    });

    it("should throw error for unknown uriType", async () => {
      const client = new RegistryClient();

      const id = {
        uriType: "unknown",
      } as any;

      await expect(client.getContent(id)).rejects.toThrow(
        "Unknown package identifier type: unknown",
      );
    });

    it("should return pre-read content directly for file with content field", async () => {
      const client = new RegistryClient();

      const id: PackageIdentifier = {
        uriType: "file",
        fileUri: "/nonexistent/path.yaml",
        content: "pre-read yaml content",
      };

      // Should return content without trying to read the nonexistent file
      const result = await client.getContent(id);
      expect(result).toBe("pre-read yaml content");
    });
  });

  describe("getContentFromFilePath", () => {
    let absoluteFilePath: string;
    let fileUrl: string;
    let relativeFilePath: string;

    beforeEach(() => {
      // Create test files
      absoluteFilePath = path.join(tempDir, "absolute-path.yaml");
      fs.writeFileSync(absoluteFilePath, "absolute file content", "utf8");

      const urlFilePath = path.join(tempDir, "file-url-path.yaml");
      fs.writeFileSync(urlFilePath, "file:// file content", "utf8");
      const url = pathToFileURL(urlFilePath);
      fileUrl = url.toString();

      // Create a subdirectory and file in the temp directory
      const subDir = path.join(tempDir, "sub");
      fs.mkdirSync(subDir, { recursive: true });
      relativeFilePath = "sub/relative-path.yaml";
      fs.writeFileSync(
        path.join(tempDir, relativeFilePath),
        "relative file content",
        "utf8",
      );
    });

    it("should read from absolute path directly", () => {
      const client = new RegistryClient();

      const result = (client as any).getContentFromFilePath(absoluteFilePath);

      expect(result).toBe("absolute file content");
    });

    it("should read from local file url directly", () => {
      const client = new RegistryClient();

      const result = (client as any).getContentFromFilePath(fileUrl);

      expect(result).toBe("file:// file content");
    });

    it("should use rootPath for relative paths when provided", () => {
      const client = new RegistryClient({ rootPath: tempDir });

      const result = (client as any).getContentFromFilePath(relativeFilePath);

      expect(result).toBe("relative file content");
    });

    it("should throw error for relative path without rootPath", () => {
      const client = new RegistryClient();

      expect(() => {
        (client as any).getContentFromFilePath("relative/path.yaml");
      }).toThrow("No rootPath provided for relative file path");
    });
  });
});
