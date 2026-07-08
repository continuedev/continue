// Note: This test file tests the formatArgs function that was used in the old ToolPermissionRequest component
// The function has been moved to ToolPermissionSelector but these tests are still valid for testing the pure function logic

// Extract the formatArgs function for testing
// This mirrors the implementation in both ToolPermissionRequest.tsx and ToolPermissionSelector.tsx
function formatArgs(args: any): string {
  if (!args || Object.keys(args).length === 0) return "";

  const firstKey = Object.keys(args)[0];
  const firstValue = args[firstKey];

  if (typeof firstValue === "string" && firstValue.length > 60) {
    return `${firstValue.substring(0, 60)}...`;
  }

  return String(firstValue);
}

describe("formatArgs function", () => {
  describe("formatArgs", () => {
    it("should return empty string for no arguments", () => {
      expect(formatArgs({})).toBe("");
      expect(formatArgs(null)).toBe("");
      expect(formatArgs(undefined)).toBe("");
    });

    it("should return first argument value as string", () => {
      expect(formatArgs({ path: "/test.txt" })).toBe("/test.txt");
      expect(formatArgs({ count: 42 })).toBe("42");
      expect(formatArgs({ enabled: true })).toBe("true");
      expect(formatArgs({ data: null })).toBe("null");
    });

    it("should truncate long strings", () => {
      const longString = "a".repeat(100);
      const result = formatArgs({ content: longString });
      expect(result).toBe("a".repeat(60) + "...");
      expect(result.length).toBe(63); // 60 chars + "..."
    });

    it("should not truncate short strings", () => {
      const shortString = "a".repeat(30);
      const result = formatArgs({ content: shortString });
      expect(result).toBe(shortString);
      expect(result).not.toContain("...");
    });

    it("should handle exactly 60 character strings", () => {
      const exactString = "a".repeat(60);
      const result = formatArgs({ content: exactString });
      expect(result).toBe(exactString);
      expect(result).not.toContain("...");
    });

    it("should handle 61 character strings", () => {
      const slightlyLongString = "a".repeat(61);
      const result = formatArgs({ content: slightlyLongString });
      expect(result).toBe("a".repeat(60) + "...");
    });

    it("should use first key when multiple arguments", () => {
      const args = { path: "/test.txt", mode: "read", format: "json" };
      const result = formatArgs(args);
      expect(result).toBe("/test.txt"); // Should use first key in insertion order
    });

    it("should handle non-string types", () => {
      expect(formatArgs({ arr: [1, 2, 3] })).toBe("1,2,3");
      expect(formatArgs({ obj: { a: 1, b: 2 } })).toBe("[object Object]");
      expect(formatArgs({ num: 123.456 })).toBe("123.456");
    });

    it("should handle special characters", () => {
      expect(formatArgs({ path: "/special/chars!@#$%^&*()_+" })).toBe(
        "/special/chars!@#$%^&*()_+",
      );
      expect(formatArgs({ emoji: "🎉🎊✨" })).toBe("🎉🎊✨");
    });
  });
});
