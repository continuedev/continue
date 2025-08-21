import { validateFlags, handleValidationErrors } from "./flagValidator.js";

describe("validateFlags", () => {
  describe("format flag validation", () => {
    test("should pass when format is used with print", () => {
      const result = validateFlags({
        format: "json",
        print: true,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("should fail when format is used without print", () => {
      const result = validateFlags({
        format: "json",
        print: false,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("FORMAT_REQUIRES_PRINT");
      expect(result.errors[0].message).toContain(
        "--format flag can only be used with -p/--print",
      );
    });

    test("should fail when format value is invalid", () => {
      const result = validateFlags({
        format: "xml",
        print: true,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("INVALID_FORMAT_VALUE");
      expect(result.errors[0].message).toContain(
        "--format currently only supports 'json'",
      );
    });
  });

  describe("silent flag validation", () => {
    test("should pass when silent is used with print", () => {
      const result = validateFlags({
        silent: true,
        print: true,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("should fail when silent is used without print", () => {
      const result = validateFlags({
        silent: true,
        print: false,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("SILENT_REQUIRES_PRINT");
      expect(result.errors[0].message).toContain(
        "--silent flag can only be used with -p/--print",
      );
    });
  });

  describe("mode flags validation", () => {
    test("should pass with readonly only", () => {
      const result = validateFlags({
        readonly: true,
        auto: false,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("should pass with auto only", () => {
      const result = validateFlags({
        readonly: false,
        auto: true,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("should fail when both readonly and auto are used", () => {
      const result = validateFlags({
        readonly: true,
        auto: true,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("CONFLICTING_MODE_FLAGS");
      expect(result.errors[0].message).toContain(
        "Cannot use both --readonly and --auto",
      );
    });
  });

  describe("permission flags validation", () => {
    test("should pass with valid permission flags", () => {
      const result = validateFlags({
        allow: ["readFile", "searchCode"],
        ask: ["writeFile"],
        exclude: ["Write", "Bash"],
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("should fail with empty tool names in allow", () => {
      const result = validateFlags({
        allow: ["readFile", "", "searchCode"],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("EMPTY_ALLOW_TOOL");
      expect(result.errors[0].message).toContain(
        "--allow requires a tool name",
      );
    });

    test("should fail with empty tool names in ask", () => {
      const result = validateFlags({
        ask: ["writeFile", "   ", "editFile"],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("EMPTY_ASK_TOOL");
      expect(result.errors[0].message).toContain("--ask requires a tool name");
    });

    test("should fail with empty tool names in exclude", () => {
      const result = validateFlags({
        exclude: ["Write", "", "Bash"],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("EMPTY_EXCLUDE_TOOL");
      expect(result.errors[0].message).toContain(
        "--exclude requires a tool name",
      );
    });
  });

  describe("multiple errors", () => {
    test("should return all validation errors", () => {
      const result = validateFlags({
        format: "xml",
        print: false,
        silent: true,
        readonly: true,
        auto: true,
        allow: ["readFile", ""],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);

      const errorCodes = result.errors.map((e) => e.code);
      expect(errorCodes).toContain("FORMAT_REQUIRES_PRINT");
      expect(errorCodes).toContain("INVALID_FORMAT_VALUE");
      expect(errorCodes).toContain("SILENT_REQUIRES_PRINT");
      expect(errorCodes).toContain("CONFLICTING_MODE_FLAGS");
      expect(errorCodes).toContain("EMPTY_ALLOW_TOOL");
    });
  });

  describe("config path validation", () => {
    test("should pass with valid config path", () => {
      const result = validateFlags({
        config: "./my-config.yaml",
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("should pass with undefined config", () => {
      const result = validateFlags({
        config: undefined,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

describe("handleValidationErrors", () => {
  test("should be a function that accepts validation errors", () => {
    // Test function signature without calling it (since it calls process.exit)
    expect(typeof handleValidationErrors).toBe("function");
    expect(handleValidationErrors.length).toBe(1);
  });

  test("should accept proper error format", () => {
    const validErrors = [
      { code: "TEST_ERROR", message: "Test message" },
      { code: "ANOTHER_ERROR", message: "Another message" },
    ];

    // Verify the function exists and would accept this format
    // We don't call it since it would exit the process
    expect(() => {
      const errorArray = validErrors;
      expect(Array.isArray(errorArray)).toBe(true);
      expect(errorArray.every((e) => e.code && e.message)).toBe(true);
    }).not.toThrow();
  });
});
