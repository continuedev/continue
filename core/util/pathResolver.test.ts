import * as os from "os";
import * as path from "path";
import { IDE } from "..";
import * as ideUtils from "./ideUtils";
import { normalizeDisplayPath, resolveInputPath } from "./pathResolver";
import * as uri from "./uri";

// Mock the resolveRelativePathInDir function
jest.mock("./ideUtils");
jest.mock("./uri");

describe("resolveUserProvidedPath", () => {
  const mockIde = {
    getWorkspaceDirs: jest.fn().mockResolvedValue(["file:///workspace"]),
    fileExists: jest.fn(),
  } as unknown as IDE;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup the mock for resolveRelativePathInDir
    (ideUtils.resolveRelativePathInDir as jest.Mock).mockImplementation(
      async (path, ide) => {
        const workspaceUri = "file:///workspace";
        // Check if the file exists in workspace
        const fullPath = `/workspace/${path}`;
        const exists = await ide.fileExists(fullPath);
        if (exists) {
          return `${workspaceUri}/${path}`;
        }
        return null;
      },
    );

    // Setup the mock for findUriInDirs
    (uri.findUriInDirs as jest.Mock).mockImplementation(
      (uri, dirUriCandidates) => {
        for (const dir of dirUriCandidates) {
          if (uri.startsWith(dir)) {
            return {
              uri,
              relativePathOrBasename: uri.slice(dir.length + 1),
              foundInDir: dir,
            };
          }
        }
        return {
          uri,
          relativePathOrBasename: uri.split("/").pop() || "",
          foundInDir: null,
        };
      },
    );
  });

  describe("file:// URIs", () => {
    it("should handle file:// URIs", async () => {
      const result = await resolveInputPath(
        mockIde,
        "file:///path/to/file.txt",
      );
      expect(result).toEqual({
        uri: "file:///path/to/file.txt",
        displayPath: "/path/to/file.txt",
        isAbsolute: true,
        isWithinWorkspace: false,
      });
    });

    it("should handle file:// URIs with encoded spaces", async () => {
      const result = await resolveInputPath(
        mockIde,
        "file:///path%20with%20spaces/file.txt",
      );
      expect(result).toEqual({
        uri: "file:///path%20with%20spaces/file.txt",
        displayPath: "/path with spaces/file.txt",
        isAbsolute: true,
        isWithinWorkspace: false,
      });
    });

    it("should detect workspace files via file:// URI", async () => {
      const result = await resolveInputPath(
        mockIde,
        "file:///workspace/src/file.txt",
      );
      expect(result).toEqual({
        uri: "file:///workspace/src/file.txt",
        displayPath: "/workspace/src/file.txt",
        isAbsolute: true,
        isWithinWorkspace: true,
      });
    });
  });

  describe("tilde paths", () => {
    it("should expand ~/path to home directory", async () => {
      const homedir = os.homedir();
      const result = await resolveInputPath(mockIde, "~/Documents/file.txt");
      expect(result).toEqual({
        uri: `file://${path.join(homedir, "Documents", "file.txt")}`,
        displayPath: path.join(homedir, "Documents", "file.txt"),
        isAbsolute: true,
        isWithinWorkspace: false,
      });
    });

    it("should expand ~ alone to home directory", async () => {
      const homedir = os.homedir();
      const result = await resolveInputPath(mockIde, "~");
      expect(result).toEqual({
        uri: `file://${homedir}`,
        displayPath: homedir,
        isAbsolute: true,
        isWithinWorkspace: false,
      });
    });

    it("should return null for ~username format", async () => {
      const result = await resolveInputPath(mockIde, "~otheruser/file.txt");
      expect(result).toBeNull();
    });
  });

  describe("absolute paths", () => {
    it("should handle Unix absolute paths", async () => {
      const result = await resolveInputPath(mockIde, "/usr/local/bin/file");
      expect(result).toEqual({
        uri: "file:///usr/local/bin/file",
        displayPath: "/usr/local/bin/file",
        isAbsolute: true,
        isWithinWorkspace: false,
      });
    });

    it("should detect workspace absolute paths", async () => {
      const result = await resolveInputPath(mockIde, "/workspace/src/file.txt");
      expect(result).toEqual({
        uri: "file:///workspace/src/file.txt",
        displayPath: "/workspace/src/file.txt",
        isAbsolute: true,
        isWithinWorkspace: true,
      });
    });

    // Skip Windows-specific tests on non-Windows platforms
    it.skip("should handle Windows drive letters", async () => {
      const result = await resolveInputPath(mockIde, "C:\\Users\\file.txt");
      expect(result).toEqual({
        uri: "file:///C:/Users/file.txt",
        displayPath: "C:\\Users\\file.txt",
        isAbsolute: true,
        isWithinWorkspace: false,
      });
    });

    it("should handle Windows network paths", async () => {
      const result = await resolveInputPath(
        mockIde,
        "\\\\server\\share\\file.txt",
      );
      expect(result).toEqual({
        uri: "file://server/share/file.txt",
        displayPath: "\\\\server\\share\\file.txt",
        isAbsolute: true,
        isWithinWorkspace: false,
      });
    });
  });

  describe("relative paths", () => {
    it("should resolve relative paths in workspace", async () => {
      mockIde.fileExists = jest.fn().mockResolvedValue(true);
      const result = await resolveInputPath(mockIde, "src/index.ts");
      expect(result).toEqual({
        uri: "file:///workspace/src/index.ts",
        displayPath: "src/index.ts",
        isAbsolute: false,
        isWithinWorkspace: true,
      });
    });

    it("should return null for non-existent relative paths", async () => {
      mockIde.fileExists = jest.fn().mockResolvedValue(false);
      const result = await resolveInputPath(mockIde, "does/not/exist.txt");
      expect(result).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("should trim whitespace from input", async () => {
      const result = await resolveInputPath(mockIde, "  /path/to/file.txt  ");
      expect(result).toEqual({
        uri: "file:///path/to/file.txt",
        displayPath: "/path/to/file.txt",
        isAbsolute: true,
        isWithinWorkspace: false,
      });
    });

    it("should handle paths with spaces", async () => {
      const result = await resolveInputPath(
        mockIde,
        "/path with spaces/file.txt",
      );
      expect(result).toEqual({
        uri: "file:///path%20with%20spaces/file.txt",
        displayPath: "/path with spaces/file.txt",
        isAbsolute: true,
        isWithinWorkspace: false,
      });
    });
  });
});

describe("normalizeDisplayPath", () => {
  it("should contract home directory to ~", () => {
    const homedir = os.homedir();

    expect(
      normalizeDisplayPath(path.join(homedir, "Documents", "file.txt")),
    ).toBe("~/Documents/file.txt");

    expect(normalizeDisplayPath("/usr/local/bin")).toBe("/usr/local/bin");
  });
});
