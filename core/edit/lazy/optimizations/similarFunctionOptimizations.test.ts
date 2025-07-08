import { dedent } from "../../../util";
import { similarFunctionAwareLazyEdit } from "./similarFunctionOptimizations";

// Test the core problem: similar functions with same return patterns
test("should correctly match functions despite similar structure", async () => {
  const oldFile = dedent`
    class Calculator {
      add(a, b) {
        const result = a + b;
        this.lastOperation = 'add';
        return this;
      }

      subtract(a, b) {
        const result = a - b;
        this.lastOperation = 'subtract';
        return this;
      }

      multiply(a, b) {
        const result = a * b;
        this.lastOperation = 'multiply';
        return this;
      }

      divide(a, b) {
        const result = a / b;
        this.lastOperation = 'divide';
        return this;
      }
    }
  `;

  const newFile = dedent`
    class Calculator {
      add(a, b) {
        const result = a + b;
        this.lastOperation = 'add';
        return this;
      }

      subtract(a, b) {
        const result = a - b;
        this.lastOperation = 'subtract';
        return this;
      }

      multiply(a, b) {
        const result = a * b;
        this.lastOperation = 'multiply';
        // Added logging for debugging
        console.log(\`Multiplying \${a} * \${b} = \${result}\`);
        return this;
      }

      divide(a, b) {
        const result = a / b;
        this.lastOperation = 'divide';
        return this;
      }
    }
  `;

  const diff = await similarFunctionAwareLazyEdit({
    oldFile,
    newLazyFile: newFile,
    filename: "calculator.js",
    enableSimilarFunctionOptimizations: true,
  });

  expect(diff).toBeDefined();

  // Should modify only the multiply function, not any other similar function
  const addedLines = diff?.filter((line) => line.type === "new") || [];
  expect(
    addedLines.some((line) =>
      line.line.includes("Added logging for debugging"),
    ),
  ).toBe(true);
  expect(addedLines.some((line) => line.line.includes("Multiplying"))).toBe(
    true,
  );

  // Should not modify the add, subtract, or divide functions
  const modifiedLines = diff?.filter((line) => line.type !== "same") || [];
  const nonMultiplyChanges = modifiedLines.filter(
    (line) =>
      !line.line.includes("multiply") &&
      !line.line.includes("Multiplying") &&
      !line.line.includes("Added logging"),
  );
  expect(nonMultiplyChanges.length).toBe(0);
});

// Test CRUD operations with similar patterns
test.skip("should handle CRUD operations with similar structure", async () => {
  const oldFile = dedent`
    class UserService {
      async createUser(data) {
        const user = new User(data);
        await this.db.save(user);
        this.logger.info('User created');
        return user;
      }

      async updateUser(id, data) {
        const user = await this.db.findById(id);
        user.update(data);
        await this.db.save(user);
        this.logger.info('User updated');
        return user;
      }

      async deleteUser(id) {
        const user = await this.db.findById(id);
        await this.db.delete(user);
        this.logger.info('User deleted');
        return true;
      }
    }
  `;

  const newFile = dedent`
    class UserService {
      async createUser(data) {
        const user = new User(data);
        await this.db.save(user);
        this.logger.info('User created');
        return user;
      }

      async updateUser(id, data) {
        const user = await this.db.findById(id);
        if (!user) {
          throw new Error(\`User with id \${id} not found\`);
        }
        user.update(data);
        await this.db.save(user);
        this.logger.info('User updated');
        return user;
      }

      async deleteUser(id) {
        const user = await this.db.findById(id);
        await this.db.delete(user);
        this.logger.info('User deleted');
        return true;
      }
    }
  `;

  const diff = await similarFunctionAwareLazyEdit({
    oldFile,
    newLazyFile: newFile,
    filename: "user-service.js",
    enableSimilarFunctionOptimizations: true,
  });

  expect(diff).toBeDefined();

  // Should add error checking only to updateUser, not to other methods
  const addedLines = diff?.filter((line) => line.type === "new") || [];
  expect(addedLines.some((line) => line.line.includes("if (!user)"))).toBe(
    true,
  );
  expect(addedLines.some((line) => line.line.includes("User with id"))).toBe(
    true,
  );

  // Verify it didn't modify createUser or deleteUser
  const changedLines = diff?.filter((line) => line.type !== "same") || [];
  const nonUpdateChanges = changedLines.filter(
    (line) =>
      !line.line.includes("updateUser") &&
      !line.line.includes("if (!user)") &&
      !line.line.includes("User with id"),
  );
  expect(nonUpdateChanges.length).toBe(0);
});

// Test class method replacement with partial file input - debug version
test("should replace class methods when given partial class content", async () => {
  const oldFile = dedent`
    class Calculator {
      constructor() {
        this.result = 0;
      }

      add(number) {
        this.result += number;
        return this;
      }

      subtract(number) {
        this.result -= number;
        return this;
      }

      multiply(number) {
        this.result *= number;
        return this;
      }

      divide(number) {
        if (number === 0) {
          throw new Error("Cannot divide by zero");
        }
        this.result /= number;
        return this;
      }

      double() {
        return this.multiply(2);
      }

      triple() {
        return this.multiply(3);
      }

      power(exponent) {
        this.result = Math.pow(this.result, exponent);
        return this;
      }

      getResult() {
        return this.result;
      }

      reset() {
        this.result = 0;
        return this;
      }
    }
  `;

  const newLazyFile = dedent`
    // ... existing code ...

      double() {
        return this.add(this.result);
      }

      triple() {
        return this.add(this.result).add(this.result);
      }

    // ... existing code ...
  `;

  const diff = await similarFunctionAwareLazyEdit({
    oldFile,
    newLazyFile: newLazyFile,
    filename: "Calculator.js",
    enableSimilarFunctionOptimizations: true,
  });

  expect(diff).toBeDefined();

  // Debug: Log the reconstructed content to see what's happening
  const reconstructed = diff?.map((line) => line.line).join("\n") || "";
  console.log("=== RECONSTRUCTED CONTENT ===");
  console.log(reconstructed);
  console.log("=== END RECONSTRUCTED CONTENT ===");

  // Check for duplication patterns
  const doubleCount = (reconstructed.match(/double\(\)/g) || []).length;
  const tripleCount = (reconstructed.match(/triple\(\)/g) || []).length;

  console.log(
    `Found ${doubleCount} double() methods and ${tripleCount} triple() methods`,
  );

  expect(doubleCount).toBe(1);
  expect(tripleCount).toBe(1);

  // Check that the new implementations are present
  expect(reconstructed).toContain("return this.add(this.result);");
  expect(reconstructed).toContain(
    "return this.add(this.result).add(this.result);",
  );

  // Check that the old implementations are not present
  expect(reconstructed).not.toContain("return this.multiply(2);");
  expect(reconstructed).not.toContain("return this.multiply(3);");
});

// Test fallback behavior when optimization fails
test("should fallback to standard approach when similar function optimization fails", async () => {
  const oldFile = dedent`
    // Not a similar function pattern
    function complexFunction() {
      const data = fetchData();
      const processed = processData(data);
      const result = transformResult(processed);
      return result;
    }
  `;

  const newFile = dedent`
    // Not a similar function pattern
    function complexFunction() {
      const data = fetchData();
      const processed = processData(data);
      const result = transformResult(processed);
      // Added logging
      console.log('Function completed');
      return result;
    }
  `;

  const diff = await similarFunctionAwareLazyEdit({
    oldFile,
    newLazyFile: newFile,
    filename: "complex.js",
    enableSimilarFunctionOptimizations: true,
  });

  expect(diff).toBeDefined();

  // Should still work via fallback to standard approach
  const addedLines = diff?.filter((line) => line.type === "new") || [];
  expect(addedLines.some((line) => line.line.includes("Added logging"))).toBe(
    true,
  );
});
