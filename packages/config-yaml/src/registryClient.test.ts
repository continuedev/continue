import * as fs from "node:fs";
import * as http from "node:http";
import { AddressInfo } from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "url";
import { PackageIdentifier } from "./interfaces/slugs.js";
import { RegistryClient } from "./registryClient.js";

describe("RegistryClient", () => {
  // Create a temp directory for test files
  let tempDir: string;
  // Setup a test server
  let server: http.Server;
  let apiBaseUrl: string;
  beforeAll(async () => {
    // Create a temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "registry-client-test-"));

    // Create a simple HTTP server for API testing
    server = http.createServer((req, res) => {
      if (req.url?.startsWith("/registry/v1/")) {
        const authHeader = req.headers.authorization;
        const data = {
          content: authHeader
            ? `auth content for ${req.url}`
            : `content for ${req.url}`,
        };

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(data));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    // Start server on a random port
    await new Promise<void>((resolve) => {
      server.listen(0, "localhost", () => resolve());
    });

    const address = server.address() as AddressInfo;
    apiBaseUrl = `http://localhost:${address.port}`;
  });

  afterAll(async () => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });

    // Close the test server
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  describe("constructor", () => {
    it("should use default apiBase if not provided", () => {
      const client = new RegistryClient();
      expect((client as any).apiBase).toBe("https://api.continue.dev/");
    });

    it("should append trailing slash to apiBase if missing", () => {
      const client = new RegistryClient({ apiBase: "https://example.com" });
      expect((client as any).apiBase).toBe("https://example.com/");
    });

    it("should keep trailing slash if apiBase already has one", () => {
      const client = new RegistryClient({ apiBase: "https://example.com/" });
      expect((client as any).apiBase).toBe("https://example.com/");
    });

    it("should store the accessToken if provided", () => {
      const client = new RegistryClient({ accessToken: "test-token" });
      expect((client as any).accessToken).toBe("test-token");
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
        filePath: testFilePath,
      };

      const result = await client.getContent(id);
      expect(result).toBe("file content");
    });

    it("should get content from slug for slug uriType", async () => {
      const client = new RegistryClient({
        apiBase: apiBaseUrl,
      });

      const id: PackageIdentifier = {
        uriType: "slug",
        fullSlug: {
          ownerSlug: "owner",
          packageSlug: "package",
          versionSlug: "1.0.0",
        },
      };

      const result = await client.getContent(id);
      expect(result).toBe("content for /registry/v1/owner/package/1.0.0");
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

  describe("getContentFromSlug", () => {
    it("should fetch content from API without auth token", async () => {
      const client = new RegistryClient({
        apiBase: apiBaseUrl,
      });
      const result = await (client as any).getContentFromSlug({
        ownerSlug: "owner",
        packageSlug: "package",
        versionSlug: "1.0.0",
      });

      expect(result).toBe("content for /registry/v1/owner/package/1.0.0");
    });

    it("should include auth token in request when provided", async () => {
      const client = new RegistryClient({
        apiBase: apiBaseUrl,
        accessToken: "test-token",
      });

      const result = await (client as any).getContentFromSlug({
        ownerSlug: "owner",
        packageSlug: "package",
        versionSlug: "1.0.0",
      });

      expect(result).toBe("auth content for /registry/v1/owner/package/1.0.0");
    });
  });
});
