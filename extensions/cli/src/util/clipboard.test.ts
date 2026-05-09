import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock child_process
vi.mock("child_process", () => ({
  exec: vi.fn(),
}));

// Mock util.promisify - Must use factory function to avoid hoisting issues
vi.mock("util", () => {
  const mockExecAsync = vi.fn();
  return {
    promisify: vi.fn(() => mockExecAsync),
    __mockExecAsync: mockExecAsync, // Export for test access
  };
});

// Mock fs/promises
vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
  unlink: vi.fn(),
}));

// Mock os
vi.mock("os", () => ({
  default: {
    platform: vi.fn(),
    tmpdir: vi.fn(),
  },
  platform: vi.fn(),
  tmpdir: vi.fn(),
}));

// Mock path
vi.mock("path", () => ({
  default: {
    join: vi.fn(),
  },
  join: vi.fn(),
}));

// Mock logger
vi.mock("./logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock core/util/index.js (Prerequisite 0b and Issue 2 alignment)
vi.mock("core/util/index.js", () => ({
  getPowerShellCommand: vi.fn(),
}));

// Import after mocks are set up
import { checkClipboardForImage, getClipboardImage } from "./clipboard.js";
import { getPowerShellCommand } from "core/util/index.js";

describe("clipboard utilities", () => {
  let mockExecAsync: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Get the mock function after module is loaded
    const util = (await import("util")) as any;
    mockExecAsync = util.__mockExecAsync;
  });

  describe("checkClipboardForImage", () => {
    it("should detect image on macOS when PNG format is present", async () => {
      const os = await import("os");
      vi.mocked(os.default.platform).mockReturnValue("darwin");
      mockExecAsync.mockResolvedValue({ stdout: "«class PNGf»", stderr: "" });

      const result = await checkClipboardForImage();
      expect(result).toBe(true);
    });

    it("should detect image on macOS when TIFF format is present", async () => {
      const os = await import("os");
      vi.mocked(os.default.platform).mockReturnValue("darwin");
      mockExecAsync.mockResolvedValue({ stdout: "«class TIFF»", stderr: "" });

      const result = await checkClipboardForImage();
      expect(result).toBe(true);
    });

    it("should detect no image on macOS when no image format is present", async () => {
      const os = await import("os");
      vi.mocked(os.default.platform).mockReturnValue("darwin");
      mockExecAsync.mockResolvedValue({ stdout: "text content", stderr: "" });

      const result = await checkClipboardForImage();
      expect(result).toBe(false);
    });

    it("should detect image on Windows using pwsh if available", async () => {
      const os = await import("os");
      vi.mocked(os.default.platform).mockReturnValue("win32");
      vi.mocked(getPowerShellCommand).mockReturnValue("pwsh");

      // Mock the actual clipboard check
      mockExecAsync.mockResolvedValue({ stdout: "1\n", stderr: "" });

      const result = await checkClipboardForImage();
      expect(result).toBe(true);
      expect(mockExecAsync).toHaveBeenCalledWith(expect.stringContaining("pwsh"));
    });

    it("should detect image on Windows using powershell if pwsh is not available", async () => {
      const os = await import("os");
      vi.mocked(os.default.platform).mockReturnValue("win32");
      vi.mocked(getPowerShellCommand).mockReturnValue("powershell");

      // Mock the actual clipboard check using powershell
      mockExecAsync.mockResolvedValue({ stdout: "1\n", stderr: "" });

      const result = await checkClipboardForImage();
      expect(result).toBe(true);
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining("powershell"),
      );
    });

    it("should detect no image on Windows when count is 0", async () => {
      const os = await import("os");
      vi.mocked(os.default.platform).mockReturnValue("win32");
      vi.mocked(getPowerShellCommand).mockReturnValue("pwsh");

      // Mock clipboard count
      mockExecAsync.mockResolvedValue({ stdout: "0\n", stderr: "" });

      const result = await checkClipboardForImage();
      expect(result).toBe(false);
    });

    it("should detect image on Linux when xclip succeeds", async () => {
      const os = await import("os");
      vi.mocked(os.default.platform).mockReturnValue("linux");
      mockExecAsync.mockResolvedValue({ stdout: "", stderr: "" });

      const result = await checkClipboardForImage();
      expect(result).toBe(true);
    });

    it("should detect no image on Linux when xclip fails", async () => {
      const os = await import("os");
      vi.mocked(os.default.platform).mockReturnValue("linux");
      mockExecAsync.mockRejectedValue(new Error("xclip failed"));

      const result = await checkClipboardForImage();
      expect(result).toBe(false);
    });

    it("should return false and log error on exception", async () => {
      const os = await import("os");
      vi.mocked(os.default.platform).mockReturnValue("darwin");
      mockExecAsync.mockRejectedValue(new Error("Unexpected error"));

      const result = await checkClipboardForImage();
      expect(result).toBe(false);
    });
  });

  describe("getClipboardImage", () => {
    const mockImageBuffer = Buffer.from("fake-image-data");

    it("should get image from clipboard on macOS", async () => {
      const os = await import("os");
      const path = await import("path");
      const fs = await import("fs/promises");

      vi.mocked(os.default.platform).mockReturnValue("darwin");
      vi.mocked(os.default.tmpdir).mockReturnValue("/tmp");
      vi.mocked(path.default.join).mockReturnValue(
        "/tmp/continue-clipboard-123.png",
      );
      mockExecAsync.mockResolvedValue({ stdout: "", stderr: "" });
      vi.mocked(fs.readFile).mockResolvedValue(mockImageBuffer);
      vi.mocked(fs.unlink).mockResolvedValue(undefined);

      const result = await getClipboardImage();
      expect(result).toEqual(mockImageBuffer);
      expect(fs.unlink).toHaveBeenCalled();
    });

    it("should get image from clipboard on Windows using pwsh if available", async () => {
      const os = await import("os");
      const path = await import("path");
      const fs = await import("fs/promises");

      vi.mocked(os.default.platform).mockReturnValue("win32");
      vi.mocked(os.default.tmpdir).mockReturnValue("C:\\temp");
      vi.mocked(path.default.join).mockReturnValue(
        "C:\\temp\\continue-clipboard-123.png",
      );
      vi.mocked(getPowerShellCommand).mockReturnValue("pwsh");

      mockExecAsync.mockResolvedValue({ stdout: "", stderr: "" });
      vi.mocked(fs.readFile).mockResolvedValue(mockImageBuffer);
      vi.mocked(fs.unlink).mockResolvedValue(undefined);

      const result = await getClipboardImage();
      expect(result).toEqual(mockImageBuffer);
      expect(mockExecAsync).toHaveBeenCalledWith(expect.stringContaining("pwsh"));
      expect(fs.unlink).toHaveBeenCalled();
    });

    it("should get image from clipboard on Windows using powershell if pwsh not available", async () => {
      const os = await import("os");
      const path = await import("path");
      const fs = await import("fs/promises");

      vi.mocked(os.default.platform).mockReturnValue("win32");
      vi.mocked(os.default.tmpdir).mockReturnValue("C:\\temp");
      vi.mocked(path.default.join).mockReturnValue(
        "C:\\temp\\continue-clipboard-123.png",
      );
      vi.mocked(getPowerShellCommand).mockReturnValue("powershell");

      mockExecAsync.mockResolvedValue({ stdout: "", stderr: "" });
      vi.mocked(fs.readFile).mockResolvedValue(mockImageBuffer);
      vi.mocked(fs.unlink).mockResolvedValue(undefined);

      const result = await getClipboardImage();
      expect(result).toEqual(mockImageBuffer);
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining("powershell"),
      );
      expect(fs.unlink).toHaveBeenCalled();
    });

    it("should get image from clipboard on Linux", async () => {
      const os = await import("os");
      const path = await import("path");
      const fs = await import("fs/promises");

      vi.mocked(os.default.platform).mockReturnValue("linux");
      vi.mocked(os.default.tmpdir).mockReturnValue("/tmp");
      vi.mocked(path.default.join).mockReturnValue(
        "/tmp/continue-clipboard-123.png",
      );
      mockExecAsync.mockResolvedValue({ stdout: "", stderr: "" });
      vi.mocked(fs.readFile).mockResolvedValue(mockImageBuffer);
      vi.mocked(fs.unlink).mockResolvedValue(undefined);

      const result = await getClipboardImage();
      expect(result).toEqual(mockImageBuffer);
      expect(fs.unlink).toHaveBeenCalled();
    });

    it("should return null for unsupported platforms", async () => {
      const os = await import("os");
      vi.mocked(os.default.platform).mockReturnValue("freebsd");

      const result = await getClipboardImage();
      expect(result).toBeNull();
    });

    it("should clean up temp file even if unlink fails", async () => {
      const os = await import("os");
      const path = await import("path");
      const fs = await import("fs/promises");

      vi.mocked(os.default.platform).mockReturnValue("darwin");
      vi.mocked(os.default.tmpdir).mockReturnValue("/tmp");
      vi.mocked(path.default.join).mockReturnValue(
        "/tmp/continue-clipboard-123.png",
      );
      mockExecAsync.mockResolvedValue({ stdout: "", stderr: "" });
      vi.mocked(fs.readFile).mockResolvedValue(mockImageBuffer);
      vi.mocked(fs.unlink).mockRejectedValue(new Error("Failed to delete"));

      const result = await getClipboardImage();
      expect(result).toEqual(mockImageBuffer);
      expect(fs.unlink).toHaveBeenCalled();
    });

    it("should return null and log error on exception", async () => {
      const os = await import("os");
      vi.mocked(os.default.platform).mockReturnValue("darwin");
      mockExecAsync.mockRejectedValue(new Error("Unexpected error"));

      const result = await getClipboardImage();
      expect(result).toBeNull();
    });
  });
});
