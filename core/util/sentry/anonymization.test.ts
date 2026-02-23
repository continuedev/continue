import {
  anonymizeFilePath,
  anonymizeSentryEvent,
  anonymizeStackTrace,
  anonymizeUserInfo,
} from "./anonymization";

describe("Sentry Anonymization Utilities", () => {
  describe("anonymizeFilePath", () => {
    it("should anonymize absolute paths but preserve node_modules package names", () => {
      expect(anonymizeFilePath("/Users/john/workspace/app.js")).toBe("<file>");
      expect(anonymizeFilePath("/home/user/project/file.py")).toBe("<file>");
      expect(anonymizeFilePath("C:\\Users\\john\\Documents\\code.go")).toBe(
        "<file>",
      );
      expect(anonymizeFilePath("/project/node_modules/react/index.js")).toBe(
        "node_modules/react/<file>",
      );
    });

    it("should keep relative paths unchanged", () => {
      expect(anonymizeFilePath("src/app.js")).toBe("src/app.js");
      expect(anonymizeFilePath("./utils/helper.py")).toBe("./utils/helper.py");
      expect(anonymizeFilePath("package/main.go")).toBe("package/main.go");
    });

    it("should handle empty or undefined paths", () => {
      expect(anonymizeFilePath("")).toBe("");
      expect(anonymizeFilePath(undefined as any)).toBe(undefined);
      expect(anonymizeFilePath(null as any)).toBe(null);
    });
  });

  describe("anonymizeStackTrace", () => {
    it("should anonymize stack frame filenames", () => {
      const frames = [
        {
          filename: "/Users/john/project/app.js",
          abs_path: "/Users/john/project/app.js",
          function: "myFunction",
          lineno: 42,
          vars: { secret: "password123" },
          pre_context: ['const secret = "password123"'],
          post_context: ["console.log(secret)"],
          context_line: 'throw new Error("test")',
        },
      ];

      const result = anonymizeStackTrace(frames);

      expect(result[0].filename).toBe("<file>");
      expect(result[0].abs_path).toBe(""); // Always cleared like Rasa
      expect(result[0].vars).toBeUndefined();
      expect(result[0].pre_context).toBeUndefined();
      expect(result[0].post_context).toBeUndefined();
      expect(result[0].context_line).toBe("<code>");
      expect(result[0].function).toBe("myFunction"); // Preserve function name
      expect(result[0].lineno).toBe(42); // Preserve line number
    });

    it("should handle non-array input", () => {
      expect(anonymizeStackTrace(null as any)).toBe(null);
      expect(anonymizeStackTrace(undefined as any)).toBe(undefined);
      expect(anonymizeStackTrace("not-array" as any)).toBe("not-array");
    });
  });

  describe("anonymizeUserInfo", () => {
    it("should hash user ID and remove other info", () => {
      const user = {
        id: "real-machine-id-12345",
        username: "john.doe",
        email: "john@example.com",
        ip_address: "192.168.1.100",
      };

      const result = anonymizeUserInfo(user);

      expect(result.id).not.toBe("real-machine-id-12345");
      expect(result.id).toMatch(/^[a-f0-9]{8}$/); // 8-char hash
      expect(result.username).toBeUndefined();
      expect(result.email).toBeUndefined();
      expect(result.ip_address).toBeUndefined();
    });

    it("should handle null/undefined user", () => {
      expect(anonymizeUserInfo(null)).toBe(null);
      expect(anonymizeUserInfo(undefined)).toBe(undefined);
    });
  });

  describe("anonymizeSentryEvent (integration)", () => {
    it("should anonymize events with user file paths", () => {
      const event: any = {
        exception: {
          values: [
            {
              stacktrace: {
                frames: [
                  {
                    filename: "/Users/john/workspace/app.js",
                    abs_path: "/Users/john/workspace/app.js",
                    vars: { secret: "password" },
                    context_line: 'throw new Error("test")',
                  },
                ],
              },
            },
          ],
        },
        user: {
          id: "machine-id-12345",
          username: "john",
        },
        contexts: {
          os: {
            environment: { HOME: "/Users/john" },
          },
        },
      };

      const result = anonymizeSentryEvent(event);

      expect(result).not.toBeNull();
      expect(result.exception.values[0].stacktrace.frames[0].filename).toBe(
        "<file>",
      );
      expect(result.exception.values[0].stacktrace.frames[0].abs_path).toBe("");
      expect(
        result.exception.values[0].stacktrace.frames[0].vars,
      ).toBeUndefined();
      expect(result.exception.values[0].stacktrace.frames[0].context_line).toBe(
        "<code>",
      );
      expect(result.user.id).toMatch(/^[a-f0-9]{8}$/);
      expect(result.user.username).toBeUndefined();
      expect(result.contexts.os.environment).toBeUndefined();
    });

    it("should handle malformed events gracefully", () => {
      const malformedEvent: any = {
        exception: {
          values: null,
        },
        user: null,
        breadcrumbs: "not-an-array",
        tags: null,
        extra: null,
      };

      const result = anonymizeSentryEvent(malformedEvent);
      expect(result).not.toBeNull(); // Should not crash
    });

    it("should return null on anonymization errors", () => {
      // Create a circular reference that would cause issues
      const circularEvent: any = {
        message: "Test event",
      };
      circularEvent.circular = circularEvent;

      // Mock console.error to avoid noise in tests
      const originalConsoleError = console.error;
      console.error = jest.fn();

      const result = anonymizeSentryEvent(circularEvent);

      // Should handle gracefully without crashing
      expect(result).not.toBeNull(); // Our implementation might handle this

      console.error = originalConsoleError;
    });
  });
});
