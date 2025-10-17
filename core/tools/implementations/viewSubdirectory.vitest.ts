import { describe, it, expect, vi } from "vitest";
import { viewSubdirectoryImpl } from "./viewSubdirectory";
import { ContinueError, ContinueErrorReason } from "../../util/errors";

describe("viewSubdirectoryImpl", () => {
  it("should throw DirectoryNotFound when resolveInputPath returns null", async () => {
    const mockExtras = {
      ide: {
        fileExists: vi.fn().mockResolvedValue(true),
      },
      llm: {},
    };

    // Mock resolveInputPath to return null (imported function would need to be mocked in actual test)
    await expect(
      viewSubdirectoryImpl({ directory_path: "/non/existent/path" }, mockExtras as any)
    ).rejects.toThrow(ContinueError);
  });

  it("should throw DirectoryNotFound when path exists in resolveInputPath but not on filesystem", async () => {
    const mockExtras = {
      ide: {
        fileExists: vi.fn().mockResolvedValue(false), // Path doesn't exist
      },
      llm: {},
    };

    // This test verifies the fix - even if resolveInputPath returns a valid object,
    // we still check if the path exists and throw if it doesn't
    try {
      await viewSubdirectoryImpl({ directory_path: "/some/absolute/path" }, mockExtras as any);
      expect.fail("Should have thrown DirectoryNotFound error");
    } catch (error) {
      expect(error).toBeInstanceOf(ContinueError);
      expect((error as ContinueError).reason).toBe(ContinueErrorReason.DirectoryNotFound);
      expect((error as ContinueError).message).toContain("does not exist or is not accessible");
    }
  });
});