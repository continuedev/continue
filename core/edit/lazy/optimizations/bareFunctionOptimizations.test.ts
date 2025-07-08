import { bareFunctionAwareLazyEdit } from "./bareFunctionOptimizations";

describe("bareFunctionOptimizations", () => {
  it("should detect and optimize bare function replacement", async () => {
    const oldFile = `
import { someUtility } from "./utils";

function calculateSum(a: number, b: number): number {
  return a + b;
}

export function processData(data: any[]) {
  return data.map(item => item.value);
}
`;

    const newLazyFile = `
function calculateSum(a: number, b: number): number {
  // Enhanced with validation
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new Error('Both arguments must be numbers');
  }
  
  return a + b;
}
`;

    const result = await bareFunctionAwareLazyEdit({
      oldFile,
      newLazyFile,
      filename: "test.ts",
    });

    expect(result).toBeDefined();
    expect(result?.length).toBeGreaterThan(0);
    
    // Should detect the function replacement and generate appropriate diff
    const newLines = result?.filter(line => line.type === "new");
    const oldLines = result?.filter(line => line.type === "old");
    
    expect(newLines?.length).toBeGreaterThan(0);
    expect(oldLines?.length).toBeGreaterThan(0);
  });

  it("should not trigger for non-bare function scenarios", async () => {
    const oldFile = `
function test() {
  return "test";
}
`;

    const newLazyFile = `
// This is not a bare function replacement
console.log("hello world");
`;

    const result = await bareFunctionAwareLazyEdit({
      oldFile,
      newLazyFile,
      filename: "test.ts",
    });

    expect(result).toBeUndefined();
  });

  it("should handle method replacements in classes", async () => {
    const oldFile = `
class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
  
  multiply(a: number, b: number): number {
    return a * b;
  }
}
`;

    const newLazyFile = `
add(a: number, b: number): number {
  // Enhanced with logging
  console.log('Adding:', a, b);
  return a + b;
}
`;

    const result = await bareFunctionAwareLazyEdit({
      oldFile,
      newLazyFile,
      filename: "test.ts",
    });

    expect(result).toBeDefined();
    expect(result?.length).toBeGreaterThan(0);
  });

  it("should handle arrow function replacements", async () => {
    const oldFile = `
const utils = {
  formatString: (str: string) => str.trim(),
  parseNumber: (str: string) => parseInt(str, 10)
};
`;

    const newLazyFile = `
const formatString = (str: string) => {
  // Enhanced formatting
  if (!str) return '';
  return str.trim().toLowerCase();
};
`;

    const result = await bareFunctionAwareLazyEdit({
      oldFile,
      newLazyFile,
      filename: "test.ts",
    });

    expect(result).toBeDefined();
    expect(result?.length).toBeGreaterThan(0);
  });
});
