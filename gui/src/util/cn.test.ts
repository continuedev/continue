import { cn } from "./cn";

describe("cn", () => {
  describe("basic class merging", () => {
    it("should merge multiple class strings", () => {
      expect(cn("foo", "bar")).toBe("foo bar");
    });

    it("should handle single class string", () => {
      expect(cn("foo")).toBe("foo");
    });

    it("should handle empty input", () => {
      expect(cn()).toBe("");
    });

    it("should handle empty strings", () => {
      expect(cn("foo", "", "bar")).toBe("foo bar");
    });
  });

  describe("tailwind class merging", () => {
    it("should merge conflicting padding classes", () => {
      expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
    });

    it("should merge conflicting margin classes", () => {
      expect(cn("mx-2", "mx-4")).toBe("mx-4");
    });

    it("should merge conflicting text color classes", () => {
      expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    });

    it("should merge conflicting background color classes", () => {
      expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500");
    });

    it("should merge conflicting width classes", () => {
      expect(cn("w-4", "w-8")).toBe("w-8");
    });

    it("should merge conflicting height classes", () => {
      expect(cn("h-4", "h-8")).toBe("h-8");
    });

    it("should preserve non-conflicting classes", () => {
      expect(cn("px-2 py-1 text-red-500")).toBe("px-2 py-1 text-red-500");
    });

    it("should handle flex utilities", () => {
      expect(cn("flex", "flex-col", "items-center")).toBe(
        "flex flex-col items-center",
      );
    });
  });

  describe("conditional classes with objects", () => {
    it("should include class when condition is true", () => {
      expect(cn("base", { active: true })).toBe("base active");
    });

    it("should exclude class when condition is false", () => {
      expect(cn("base", { active: false })).toBe("base");
    });

    it("should handle multiple conditional classes", () => {
      expect(cn("base", { active: true, disabled: false, hidden: true })).toBe(
        "base active hidden",
      );
    });

    it("should merge conditional tailwind classes", () => {
      expect(cn("text-red-500", { "text-blue-500": true })).toBe(
        "text-blue-500",
      );
    });
  });

  describe("array inputs", () => {
    it("should handle array of classes", () => {
      expect(cn(["foo", "bar"])).toBe("foo bar");
    });

    it("should handle mixed arrays and strings", () => {
      expect(cn("foo", ["bar", "baz"], "qux")).toBe("foo bar baz qux");
    });

    it("should handle nested arrays", () => {
      expect(cn(["foo", ["bar", "baz"]])).toBe("foo bar baz");
    });
  });

  describe("falsy values", () => {
    it("should ignore null values", () => {
      expect(cn("foo", null, "bar")).toBe("foo bar");
    });

    it("should ignore undefined values", () => {
      expect(cn("foo", undefined, "bar")).toBe("foo bar");
    });

    it("should ignore false values", () => {
      expect(cn("foo", false, "bar")).toBe("foo bar");
    });

    it("should handle only falsy values", () => {
      expect(cn(null, undefined, false)).toBe("");
    });
  });

  describe("complex tailwind patterns", () => {
    it("should merge responsive classes correctly", () => {
      expect(cn("sm:px-2 md:px-4", "sm:px-4")).toBe("md:px-4 sm:px-4");
    });

    it("should merge hover state classes", () => {
      expect(cn("hover:bg-red-500", "hover:bg-blue-500")).toBe(
        "hover:bg-blue-500",
      );
    });

    it("should preserve different pseudo-state classes", () => {
      expect(cn("hover:bg-red-500", "focus:bg-blue-500")).toBe(
        "hover:bg-red-500 focus:bg-blue-500",
      );
    });

    it("should handle border classes", () => {
      expect(cn("border-2", "border-4", "border-red-500")).toBe(
        "border-4 border-red-500",
      );
    });

    it("should handle rounded classes", () => {
      expect(cn("rounded", "rounded-lg")).toBe("rounded-lg");
    });
  });

  describe("real-world use cases", () => {
    it("should handle button styling pattern", () => {
      const isDisabled = false;
      const isActive = true;
      expect(
        cn(
          "px-4 py-2 rounded font-medium",
          "bg-blue-500 text-white",
          { "opacity-50 cursor-not-allowed": isDisabled },
          { "ring-2 ring-blue-300": isActive },
        ),
      ).toBe(
        "px-4 py-2 rounded font-medium bg-blue-500 text-white ring-2 ring-blue-300",
      );
    });

    it("should handle card component pattern", () => {
      expect(
        cn(
          "p-4 rounded-lg shadow-md",
          "bg-white dark:bg-gray-800",
          "border border-gray-200",
        ),
      ).toBe(
        "p-4 rounded-lg shadow-md bg-white dark:bg-gray-800 border border-gray-200",
      );
    });

    it("should handle input field pattern", () => {
      const hasError = true;
      expect(
        cn(
          "w-full px-3 py-2 border rounded-md",
          "focus:outline-none focus:ring-2",
          hasError
            ? "border-red-500 focus:ring-red-200"
            : "border-gray-300 focus:ring-blue-200",
        ),
      ).toBe(
        "w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 border-red-500 focus:ring-red-200",
      );
    });
  });
});
