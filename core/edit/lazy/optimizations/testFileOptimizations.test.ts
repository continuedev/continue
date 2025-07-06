import { dedent } from "../../../util";
import {
  createTestLazyComments,
  testAwareLazyEdit,
  validateTestFileDiff,
} from "./testFileOptimizations";

// Test adding new test cases to existing describe block
test("should handle adding new test case to existing describe block", async () => {
  const oldFile = dedent`
    import { Calculator } from './calculator';

    describe('Calculator', () => {
      let calc;
      
      beforeEach(() => {
        calc = new Calculator();
      });

      test('should add numbers correctly', () => {
        expect(calc.add(2, 3)).toBe(5);
      });

      test('should subtract numbers correctly', () => {
        expect(calc.subtract(5, 3)).toBe(2);
      });
    });
  `;

  const newFile = dedent`
    import { Calculator } from './calculator';

    describe('Calculator', () => {
      let calc;
      
      beforeEach(() => {
        calc = new Calculator();
      });

      test('should add numbers correctly', () => {
        expect(calc.add(2, 3)).toBe(5);
      });

      test('should subtract numbers correctly', () => {
        expect(calc.subtract(5, 3)).toBe(2);
      });

      // ... existing tests ...

      test('should multiply numbers correctly', () => {
        expect(calc.multiply(4, 3)).toBe(12);
      });
    });
  `;

  const diff = await testAwareLazyEdit({
    oldFile,
    newLazyFile: newFile,
    filename: "calculator.test.js",
    enableTestOptimizations: true,
  });

  expect(diff).toBeDefined();

  // Should add the new multiply test
  const addedLines = diff?.filter((line) => line.type === "new") || [];
  expect(
    addedLines.some((line) => line.line.includes("multiply numbers correctly")),
  ).toBe(true);
  expect(
    addedLines.some((line) => line.line.includes("calc.multiply(4, 3)")),
  ).toBe(true);
});

// Test adding setup/teardown code
test("should handle adding beforeEach/afterEach blocks", async () => {
  const oldFile = dedent`
    describe('Database Tests', () => {
      test('should save user', () => {
        const user = new User('John');
        user.save();
        expect(user.id).toBeDefined();
      });

      test('should delete user', () => {
        const user = new User('Jane');
        user.save();
        user.delete();
        expect(user.isDeleted).toBe(true);
      });
    });
  `;

  const newFile = dedent`
    describe('Database Tests', () => {
      beforeEach(() => {
        // Clean database before each test
        database.clear();
      });

      afterEach(() => {
        // Cleanup after each test
        database.disconnect();
      });

      test('should save user', () => {
        const user = new User('John');
        user.save();
        expect(user.id).toBeDefined();
      });

      test('should delete user', () => {
        const user = new User('Jane');
        user.save();
        user.delete();
        expect(user.isDeleted).toBe(true);
      });
    });
  `;

  const diff = await testAwareLazyEdit({
    oldFile,
    newLazyFile: newFile,
    filename: "database.test.js",
  });

  expect(diff).toBeDefined();

  // Should add setup/teardown blocks (may fall back to standard diff)
  const allLines = diff?.map((line) => line.line).join("\n") || "";
  expect(allLines).toContain("beforeEach");
  expect(allLines).toContain("afterEach");
  expect(allLines).toContain("database.clear()");
});

// Test Vitest-specific syntax
test("should handle Vitest syntax and patterns", async () => {
  const oldFile = dedent`
    import { describe, test, expect, beforeEach } from 'vitest';
    import { UserService } from './user-service';

    describe('UserService', () => {
      let userService;

      beforeEach(() => {
        userService = new UserService();
      });

      test('should create user', () => {
        const user = userService.createUser('John', 'john@example.com');
        expect(user.name).toBe('John');
        expect(user.email).toBe('john@example.com');
      });
    });
  `;

  const newFile = dedent`
    import { describe, test, expect, beforeEach } from 'vitest';
    import { UserService } from './user-service';

    describe('UserService', () => {
      let userService;

      beforeEach(() => {
        userService = new UserService();
      });

      test('should create user', () => {
        const user = userService.createUser('John', 'john@example.com');
        expect(user.name).toBe('John');
        expect(user.email).toBe('john@example.com');
      });

      // ... existing tests ...

      test('should validate email format', () => {
        expect(() => {
          userService.createUser('John', 'invalid-email');
        }).toThrow('Invalid email format');
      });
    });
  `;

  const diff = await testAwareLazyEdit({
    oldFile,
    newLazyFile: newFile,
    filename: "user-service.test.ts",
  });

  expect(diff).toBeDefined();

  // Should handle Vitest imports and add new test
  const addedLines = diff?.filter((line) => line.type === "new") || [];
  expect(
    addedLines.some((line) => line.line.includes("validate email format")),
  ).toBe(true);
  expect(addedLines.some((line) => line.line.includes("toThrow"))).toBe(true);
});

// Test test file validation
test("should validate test file diff quality", () => {
  const oldContent = dedent`
    describe('Tests', () => {
      test('first test', () => {
        expect(1).toBe(1);
      });
    });
  `;

  const goodNewContent = dedent`
    describe('Tests', () => {
      test('first test', () => {
        expect(1).toBe(1);
      });
      
      test('second test', () => {
        expect(2).toBe(2);
      });
    });
  `;

  const badNewContent = dedent`
    // All tests removed
    console.log('No tests here');
  `;

  // Good diff should pass validation
  const goodDiff = [
    { type: "same" as const, line: "describe('Tests', () => {" },
    { type: "same" as const, line: "  test('first test', () => {" },
    { type: "same" as const, line: "    expect(1).toBe(1);" },
    { type: "same" as const, line: "  });" },
    { type: "new" as const, line: "  test('second test', () => {" },
    { type: "new" as const, line: "    expect(2).toBe(2);" },
    { type: "new" as const, line: "  });" },
    { type: "same" as const, line: "});" },
  ];

  const goodValidation = validateTestFileDiff(
    goodDiff,
    oldContent,
    goodNewContent,
  );
  expect(goodValidation.isValid).toBe(true);
  expect(goodValidation.confidence).toBeGreaterThan(0.8);

  // Bad diff should fail validation
  const badDiff = [
    { type: "old" as const, line: "describe('Tests', () => {" },
    { type: "old" as const, line: "  test('first test', () => {" },
    { type: "old" as const, line: "    expect(1).toBe(1);" },
    { type: "old" as const, line: "  });" },
    { type: "old" as const, line: "});" },
    { type: "new" as const, line: "// All tests removed" },
    { type: "new" as const, line: "console.log('No tests here');" },
  ];

  const badValidation = validateTestFileDiff(
    badDiff,
    oldContent,
    badNewContent,
  );
  expect(badValidation.isValid).toBe(false);
  expect(badValidation.issues).toContain(
    "All tests appear to have been removed",
  );
});

// Test lazy comment creation for test files
test("should create test-specific lazy comments", () => {
  const jestComments = createTestLazyComments("jest");
  const vitestComments = createTestLazyComments("vitest");

  expect(jestComments).toContain("// ... existing tests ...");
  expect(jestComments).toContain("// ... setup code ...");
  expect(jestComments).toContain("// ... helper functions ...");

  expect(vitestComments).toEqual(jestComments); // Should be the same for now
});
