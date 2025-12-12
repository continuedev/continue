import { promises as fs } from "fs";
import path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { memoryTool } from "./memory.js";

// Mock fs module
vi.mock("fs", async () => {
  const actual = await vi.importActual("fs");
  return {
    ...actual,
    promises: {
      mkdir: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      readdir: vi.fn(),
      stat: vi.fn(),
      access: vi.fn(),
      unlink: vi.fn(),
      rm: vi.fn(),
      rename: vi.fn(),
    },
  };
});

describe("memoryTool", () => {
  const mockMemoryRoot = path.join(
    process.cwd(),
    ".continue",
    "memory",
    "memories",
  );

  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mocks
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.access).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("metadata", () => {
    it("should have correct tool metadata", () => {
      expect(memoryTool.name).toBe("memory");
      expect(memoryTool.type).toBe("memory_20250818");
      expect(memoryTool.displayName).toBe("Memory");
      expect(memoryTool.description).toBe("Anthropic claude memory tool");
      expect(memoryTool.readonly).toBe(false);
      expect(memoryTool.isBuiltIn).toBe(true);
      expect(memoryTool.parameters.type).toBe("object");
      expect(memoryTool.parameters.required).toContain("command");
    });
  });

  describe("path validation", () => {
    it("should reject paths not starting with /memories", async () => {
      const result = await memoryTool.run({
        command: "view",
        path: "/other/path",
      });
      expect(result).toContain("Error: Path must start with /memories");
    });

    it("should normalize '.' to /memories", async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false,
      } as any);
      vi.mocked(fs.readdir).mockResolvedValue([]);

      const result = await memoryTool.run({
        command: "view",
        path: ".",
      });
      expect(result).toContain("Directory: .");
    });

    it("should reject empty string as invalid", async () => {
      const result = await memoryTool.run({
        command: "view",
        path: "",
      });
      expect(result).toContain("Error: Path is required and must be a string");
    });

    it("should normalize 'memories' to /memories", async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false,
      } as any);
      vi.mocked(fs.readdir).mockResolvedValue([]);

      const result = await memoryTool.run({
        command: "view",
        path: "memories",
      });
      expect(result).toContain("Directory:");
    });

    it("should add leading slash if missing", async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false,
      } as any);
      vi.mocked(fs.readdir).mockResolvedValue([]);

      const result = await memoryTool.run({
        command: "view",
        path: "memories/test",
      });
      expect(result).not.toContain("Error");
    });

    it("should reject path traversal attempts", async () => {
      const result = await memoryTool.run({
        command: "view",
        path: "/memories/../../../etc/passwd",
      });
      expect(result).toContain(
        "Error: Path /memories/../../../etc/passwd would escape /memories directory",
      );
    });

    it("should reject invalid path types", async () => {
      const result = await memoryTool.run({
        command: "view",
        path: null as any,
      });
      expect(result).toContain("Error: Path is required and must be a string");
    });
  });

  describe("view command", () => {
    it("should view empty directory", async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false,
      } as any);
      vi.mocked(fs.readdir).mockResolvedValue([]);

      const result = await memoryTool.run({
        command: "view",
        path: "/memories/projects",
      });

      expect(result).toBe("Directory: /memories/projects");
    });

    it("should view directory with files", async () => {
      vi.mocked(fs.stat)
        .mockResolvedValueOnce({
          isDirectory: () => true,
          isFile: () => false,
        } as any)
        .mockResolvedValueOnce({
          isDirectory: () => false,
          isFile: () => true,
        } as any)
        .mockResolvedValueOnce({
          isDirectory: () => true,
          isFile: () => false,
        } as any);
      vi.mocked(fs.readdir).mockResolvedValue([
        "notes.txt",
        "subfolder",
      ] as any);

      const result = await memoryTool.run({
        command: "view",
        path: "/memories/projects",
      });

      expect(result).toContain("Directory: /memories/projects");
      expect(result).toContain("- notes.txt");
      expect(result).toContain("- subfolder/");
    });

    it("should skip hidden files in directory listing", async () => {
      vi.mocked(fs.stat)
        .mockResolvedValueOnce({
          isDirectory: () => true,
          isFile: () => false,
        } as any)
        .mockResolvedValueOnce({
          isDirectory: () => false,
          isFile: () => true,
        } as any);
      vi.mocked(fs.readdir).mockResolvedValue([
        ".hidden",
        "visible.txt",
      ] as any);

      const result = await memoryTool.run({
        command: "view",
        path: "/memories",
      });

      expect(result).not.toContain(".hidden");
      expect(result).toContain("visible.txt");
    });

    it("should view file with line numbers", async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true,
      } as any);
      vi.mocked(fs.readFile).mockResolvedValue("Line 1\nLine 2\nLine 3");

      const result = await memoryTool.run({
        command: "view",
        path: "/memories/test.txt",
      });

      expect(result).toContain("   1: Line 1");
      expect(result).toContain("   2: Line 2");
      expect(result).toContain("   3: Line 3");
    });

    it("should view file with line range", async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true,
      } as any);
      vi.mocked(fs.readFile).mockResolvedValue(
        "Line 1\nLine 2\nLine 3\nLine 4\nLine 5",
      );

      const result = await memoryTool.run({
        command: "view",
        path: "/memories/test.txt",
        view_range: [2, 4],
      });

      expect(result).not.toContain("Line 1");
      expect(result).toContain("   2: Line 2");
      expect(result).toContain("   3: Line 3");
      expect(result).toContain("   4: Line 4");
      expect(result).not.toContain("Line 5");
    });

    it("should handle -1 as end range to show till end", async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true,
      } as any);
      vi.mocked(fs.readFile).mockResolvedValue("Line 1\nLine 2\nLine 3");

      const result = await memoryTool.run({
        command: "view",
        path: "/memories/test.txt",
        view_range: [2, -1],
      });

      expect(result).toContain("   2: Line 2");
      expect(result).toContain("   3: Line 3");
    });

    it("should return error for non-existent path", async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));

      const result = await memoryTool.run({
        command: "view",
        path: "/memories/nonexistent",
      });

      expect(result).toContain("Error: Path not found: /memories/nonexistent");
    });
  });

  describe("create command", () => {
    it("should create file successfully", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();

      const result = await memoryTool.run({
        command: "create",
        path: "/memories/new-file.txt",
        file_text: "Hello World",
      });

      expect(result).toBe(
        "File created successfully at /memories/new-file.txt",
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("new-file.txt"),
        "Hello World",
        "utf-8",
      );
    });

    it("should create directory if it doesn't exist and create file successfully", async () => {
      vi.mocked(fs.access)
        .mockRejectedValueOnce(new Error("ENOENT"))
        .mockResolvedValueOnce(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();

      const result = await memoryTool.run({
        command: "create",
        path: "/memories/newdir/file.txt",
        file_text: "Content",
      });

      expect(result).toBe(
        "File created successfully at /memories/newdir/file.txt",
      );
      expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining("newdir"), {
        recursive: true,
      });
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe("str_replace command", () => {
    it("should replace unique string in file", async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true,
      } as any);
      vi.mocked(fs.readFile).mockResolvedValue("Hello World\nGoodbye World");
      vi.mocked(fs.writeFile).mockResolvedValue();

      const result = await memoryTool.run({
        command: "str_replace",
        path: "/memories/test.txt",
        old_str: "Hello World",
        new_str: "Hi Universe",
      });

      expect(result).toBe("File /memories/test.txt has been edited");
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        "Hi Universe\nGoodbye World",
        "utf-8",
      );
    });

    it("should error if string not found", async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true,
      } as any);
      vi.mocked(fs.readFile).mockResolvedValue("Hello World");

      const result = await memoryTool.run({
        command: "str_replace",
        path: "/memories/test.txt",
        old_str: "Not Found",
        new_str: "New Text",
      });

      expect(result).toContain("Error: Text not found in /memories/test.txt");
    });

    it("should error if string appears multiple times", async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true,
      } as any);
      vi.mocked(fs.readFile).mockResolvedValue("World World World");

      const result = await memoryTool.run({
        command: "str_replace",
        path: "/memories/test.txt",
        old_str: "World",
        new_str: "Universe",
      });

      expect(result).toContain("Error: Text appears 3 times");
      expect(result).toContain("Must be unique");
    });

    it("should error for non-existent file", async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));

      const result = await memoryTool.run({
        command: "str_replace",
        path: "/memories/nonexistent.txt",
        old_str: "old",
        new_str: "new",
      });

      expect(result).toContain("Error: File not found");
    });

    it("should error if path is not a file", async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false,
      } as any);

      const result = await memoryTool.run({
        command: "str_replace",
        path: "/memories/directory",
        old_str: "old",
        new_str: "new",
      });

      expect(result).toContain("Error: Path is not a file");
    });
  });

  describe("insert command", () => {
    it("should insert text at specified line", async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true,
      } as any);
      vi.mocked(fs.readFile).mockResolvedValue("Line 1\nLine 2\nLine 3");
      vi.mocked(fs.writeFile).mockResolvedValue();

      const result = await memoryTool.run({
        command: "insert",
        path: "/memories/test.txt",
        insert_line: 1,
        insert_text: "Inserted Line",
      });

      expect(result).toBe("Text inserted at line 1 in /memories/test.txt");
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        "Line 1\nInserted Line\nLine 2\nLine 3",
        "utf-8",
      );
    });

    it("should insert at beginning (line 0)", async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true,
      } as any);
      vi.mocked(fs.readFile).mockResolvedValue("Line 1\nLine 2");
      vi.mocked(fs.writeFile).mockResolvedValue();

      const result = await memoryTool.run({
        command: "insert",
        path: "/memories/test.txt",
        insert_line: 0,
        insert_text: "First Line",
      });

      expect(result).toContain("Text inserted at line 0");
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        "First Line\nLine 1\nLine 2",
        "utf-8",
      );
    });

    it("should insert at end of file", async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true,
      } as any);
      vi.mocked(fs.readFile).mockResolvedValue("Line 1\nLine 2");
      vi.mocked(fs.writeFile).mockResolvedValue();

      const result = await memoryTool.run({
        command: "insert",
        path: "/memories/test.txt",
        insert_line: 2,
        insert_text: "Last Line",
      });

      expect(result).toContain("Text inserted at line 2");
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        "Line 1\nLine 2\nLast Line",
        "utf-8",
      );
    });

    it("should strip trailing newline from insert_text", async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true,
      } as any);
      vi.mocked(fs.readFile).mockResolvedValue("Line 1");
      vi.mocked(fs.writeFile).mockResolvedValue();

      await memoryTool.run({
        command: "insert",
        path: "/memories/test.txt",
        insert_line: 1,
        insert_text: "New Line\n",
      });

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        "Line 1\nNew Line",
        "utf-8",
      );
    });

    it("should error for invalid line number", async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true,
      } as any);
      vi.mocked(fs.readFile).mockResolvedValue("Line 1\nLine 2");

      const result = await memoryTool.run({
        command: "insert",
        path: "/memories/test.txt",
        insert_line: 10,
        insert_text: "Text",
      });

      expect(result).toContain("Error: Invalid insert_line 10");
    });

    it("should error for negative line number", async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true,
      } as any);
      vi.mocked(fs.readFile).mockResolvedValue("Line 1");

      const result = await memoryTool.run({
        command: "insert",
        path: "/memories/test.txt",
        insert_line: -1,
        insert_text: "Text",
      });

      expect(result).toContain("Error: Invalid insert_line -1");
    });
  });

  describe("delete command", () => {
    it("should delete file", async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true,
      } as any);
      vi.mocked(fs.unlink).mockResolvedValue();

      const result = await memoryTool.run({
        command: "delete",
        path: "/memories/test.txt",
      });

      expect(result).toBe("File deleted: /memories/test.txt");
      expect(fs.unlink).toHaveBeenCalled();
    });

    it("should delete directory recursively", async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false,
      } as any);
      vi.mocked(fs.rm).mockResolvedValue();

      const result = await memoryTool.run({
        command: "delete",
        path: "/memories/folder",
      });

      expect(result).toBe("Directory deleted: /memories/folder");
      expect(fs.rm).toHaveBeenCalledWith(expect.any(String), {
        recursive: true,
        force: true,
      });
    });

    it("should prevent deleting /memories root", async () => {
      const result = await memoryTool.run({
        command: "delete",
        path: "/memories",
      });

      expect(result).toContain(
        "Error: Cannot delete the /memories directory itself",
      );
    });

    it("should error for non-existent path", async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));

      const result = await memoryTool.run({
        command: "delete",
        path: "/memories/nonexistent",
      });

      expect(result).toContain("Error: Path not found");
    });
  });

  describe("rename command", () => {
    it("should rename file successfully", async () => {
      vi.mocked(fs.access)
        .mockResolvedValueOnce(undefined) // old path exists
        .mockRejectedValueOnce(new Error("ENOENT")) // new path doesn't exist
        .mockResolvedValueOnce(undefined); // parent dir exists
      vi.mocked(fs.rename).mockResolvedValue();

      const result = await memoryTool.run({
        command: "rename",
        old_path: "/memories/old.txt",
        new_path: "/memories/new.txt",
      });

      expect(result).toBe("Renamed /memories/old.txt to /memories/new.txt");
      expect(fs.rename).toHaveBeenCalled();
    });

    it("should create parent directory if needed", async () => {
      vi.mocked(fs.access)
        .mockResolvedValueOnce(undefined) // old path exists
        .mockRejectedValueOnce(new Error("ENOENT")) // new path doesn't exist
        .mockRejectedValueOnce(new Error("ENOENT")); // parent dir doesn't exist
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.rename).mockResolvedValue();

      const result = await memoryTool.run({
        command: "rename",
        old_path: "/memories/old.txt",
        new_path: "/memories/newdir/new.txt",
      });

      expect(result).toContain("Renamed");
      expect(fs.mkdir).toHaveBeenCalledWith(expect.any(String), {
        recursive: true,
      });
    });

    it("should error if source doesn't exist", async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));

      const result = await memoryTool.run({
        command: "rename",
        old_path: "/memories/nonexistent.txt",
        new_path: "/memories/new.txt",
      });

      expect(result).toContain("Error: Source path not found");
    });

    it("should error if destination already exists", async () => {
      vi.mocked(fs.access)
        .mockResolvedValueOnce(undefined) // old path exists
        .mockResolvedValueOnce(undefined); // new path also exists

      const result = await memoryTool.run({
        command: "rename",
        old_path: "/memories/old.txt",
        new_path: "/memories/existing.txt",
      });

      expect(result).toContain("Error: Destination already exists");
    });
  });

  describe("error handling", () => {
    it("should handle missing command argument", async () => {
      const result = await memoryTool.run({});
      expect(result).toContain("Error: The `command` argument is required");
    });

    it("should handle invalid command", async () => {
      const result = await memoryTool.run({
        command: "invalid_command" as any,
        path: "/memories/test",
      });

      expect(result).toContain("Error: Unsupported command");
    });

    it("should handle null arguments", async () => {
      const result = await memoryTool.run(null as any);
      expect(result).toContain("Error: The `command` argument is required");
    });

    it("should wrap unknown errors", async () => {
      vi.mocked(fs.access).mockRejectedValue("Unknown error");

      const result = await memoryTool.run({
        command: "view",
        path: "/memories/test",
      });

      expect(result).toContain("Error:");
    });
  });
});
