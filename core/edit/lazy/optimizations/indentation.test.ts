import { bareFunctionAwareLazyEdit } from "./bareFunctionOptimizations";

describe("indentation preservation", () => {
  test("should preserve indentation when replacing class methods", async () => {
    const oldFile = `class Calculator {
  constructor() {
    this.value = 0;
  }

  add(n) {
    this.value += n;
    return this;
  }

  multiply(n) {
    this.value *= n;
    return this;
  }
}`;

    const newLazyFile = `add(n) {
  this.value += n;
  console.log('Added:', n);
  return this;
}`;

    const result = await bareFunctionAwareLazyEdit({
      oldFile,
      newLazyFile,
      filename: "Calculator.js",
      enableBareFunctionOptimizations: true,
    });

    expect(result).toBeDefined();

    // Find the new function line
    const addFunctionLine = result!.find(
      (line) => line.type === "new" && line.line.includes("add(n)"),
    );

    expect(addFunctionLine).toBeDefined();

    // Check that indentation is preserved (should be 2 spaces for class method)
    const indentMatch = addFunctionLine!.line.match(/^(\s*)/);
    const indentLength = indentMatch ? indentMatch[1].length : 0;

    console.log(`Function line: "${addFunctionLine!.line}"`);
    console.log(`Indentation length: ${indentLength}`);

    expect(indentLength).toBe(2);

    // Also check that the console.log line has proper indentation (4 spaces)
    const consoleLogLine = result!.find(
      (line) => line.type === "new" && line.line.includes("console.log"),
    );

    expect(consoleLogLine).toBeDefined();
    const consoleIndentMatch = consoleLogLine!.line.match(/^(\s*)/);
    const consoleIndentLength = consoleIndentMatch
      ? consoleIndentMatch[1].length
      : 0;

    console.log(`Console line: "${consoleLogLine!.line}"`);
    console.log(`Console indentation length: ${consoleIndentLength}`);

    expect(consoleIndentLength).toBe(4); // Should be 2 (class) + 2 (function body)

    // Reconstruct and verify final result
    const reconstructed = result!.map((line) => line.line).join("\n");

    // Should contain the new function with proper indentation
    expect(reconstructed).toContain("  add(n) {");
    expect(reconstructed).toContain("    this.value += n;");
    expect(reconstructed).toContain("    console.log('Added:', n);");
    expect(reconstructed).toContain("    return this;");
    expect(reconstructed).toContain("  }");
  });

  test("should preserve indentation for top-level functions", async () => {
    const oldFile = `function calculateSum(a, b) {
  return a + b;
}

function calculateProduct(a, b) {
  return a * b;
}`;

    const newLazyFile = `calculateSum(a, b) {
  const result = a + b;
  console.log('Sum:', result);
  return result;
}`;

    const result = await bareFunctionAwareLazyEdit({
      oldFile,
      newLazyFile,
      filename: "math.js",
      enableBareFunctionOptimizations: true,
    });

    expect(result).toBeDefined();

    // Find the new function line
    const funcLine = result!.find(
      (line) => line.type === "new" && line.line.includes("calculateSum(a, b)"),
    );

    expect(funcLine).toBeDefined();

    // Top-level function should have no indentation
    const indentMatch = funcLine!.line.match(/^(\s*)/);
    const indentLength = indentMatch ? indentMatch[1].length : 0;

    console.log(`Top-level function line: "${funcLine!.line}"`);
    console.log(`Top-level indentation length: ${indentLength}`);

    expect(indentLength).toBe(0);

    // Function body should have 2 spaces
    const bodyLine = result!.find(
      (line) => line.type === "new" && line.line.includes("const result"),
    );

    expect(bodyLine).toBeDefined();
    const bodyIndentMatch = bodyLine!.line.match(/^(\s*)/);
    const bodyIndentLength = bodyIndentMatch ? bodyIndentMatch[1].length : 0;

    console.log(`Body line: "${bodyLine!.line}"`);
    console.log(`Body indentation length: ${bodyIndentLength}`);

    expect(bodyIndentLength).toBe(2);
  });
});
