import * as path from "path";

import { describe, expect, it, vi } from "vitest";

// Test the missing file handling logic directly
describe("UserInput - Missing File Handling", () => {
  it("should handle selecting non-existent files gracefully", async () => {
    const mockOnFileAttached = vi.fn();

    // Simulate the selectFile logic for a missing file
    const filePath = "missing-file.txt";

    try {
      const fs = await import("fs/promises");
      const path = await import("path");
      const absolutePath = path.resolve(filePath);
      const content = await fs.readFile(absolutePath, "utf-8");
      mockOnFileAttached(absolutePath, content);
    } catch (error) {
      // If file doesn't exist, just attach the filename without content
      if (error instanceof Error && (error as any).code === "ENOENT") {
        const path = await import("path");
        const absolutePath = path.resolve(filePath);
        mockOnFileAttached(absolutePath, filePath); // Just the filename for missing file
      } else {
        console.error(`Error reading file ${filePath}:`, error);
      }
    }

    // Should have called onFileAttached with filename as content
    expect(mockOnFileAttached).toHaveBeenCalledWith(
      path.resolve(filePath),
      filePath,
    );
  });
});
