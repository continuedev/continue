import { dedent } from "../../../util";
import { reorderAwareLazyEdit } from "./reorderAwareOptimizations";

// Test basic function reordering with alphabetical pattern
test("should handle alphabetical function reordering", async () => {
  const oldFile = dedent`
    class MathUtils {
      multiply(a, b) {
        return a * b;
      }

      add(a, b) {
        return a + b;
      }

      divide(a, b) {
        return a / b;
      }
    }
  `;

  const newFile = dedent`
    class MathUtils {
      // Functions now in alphabetical order
      add(a, b) {
        return a + b;
      }

      divide(a, b) {
        return a / b;
      }

      multiply(a, b) {
        return a * b;
        // Added logging
        console.log('Multiplication performed');
      }
    }
  `;

  const diff = await reorderAwareLazyEdit({
    oldFile,
    newLazyFile: newFile,
    filename: "math-utils.js",
    enableReorderOptimizations: true,
  });

  expect(diff).toBeDefined();

  // Should detect the reordering and properly match the multiply function
  const addedLines = diff?.filter((line) => line.type === "new") || [];
  expect(
    addedLines.some((line) =>
      line.line.includes("Functions now in alphabetical order"),
    ),
  ).toBe(true);
  expect(addedLines.some((line) => line.line.includes("Added logging"))).toBe(
    true,
  );
  expect(
    addedLines.some((line) => line.line.includes("Multiplication performed")),
  ).toBe(true);
});

// Test dependency-based reordering
test("should handle dependency-based function reordering", async () => {
  const oldFile = dedent`
    class DataProcessor {
      processData(data) {
        this.validateInput(data);
        return data.map(item => item.value);
      }

      generateReport(data) {
        const processed = this.processData(data);
        return \`Report: \${processed.join(', ')}\`;
      }

      validateInput(data) {
        if (!data) throw new Error('No data');
        return true;
      }
    }
  `;

  const newFile = dedent`
    class DataProcessor {
      // Reordered by dependencies
      validateInput(data) {
        if (!data) throw new Error('No data');
        // Enhanced validation
        if (!Array.isArray(data)) throw new Error('Must be array');
        return true;
      }

      processData(data) {
        this.validateInput(data);
        return data.map(item => item.value);
      }

      generateReport(data) {
        const processed = this.processData(data);
        return \`Report: \${processed.join(', ')}\`;
      }
    }
  `;

  const diff = await reorderAwareLazyEdit({
    oldFile,
    newLazyFile: newFile,
    filename: "data-processor.js",
    enableReorderOptimizations: true,
  });

  expect(diff).toBeDefined();

  // Should properly identify and modify the validateInput function
  const addedLines = diff?.filter((line) => line.type === "new") || [];
  expect(
    addedLines.some((line) => line.line.includes("Enhanced validation")),
  ).toBe(true);
  expect(addedLines.some((line) => line.line.includes("Must be array"))).toBe(
    true,
  );
});

// Test fallback to standard approach
test("should fallback to standard approach when reordering optimization fails", async () => {
  const oldFile = dedent`






































































    // Not a reordering pattern
    function complexFunction() {
        const data = fetchData();
        const processed = processData(data);



      const result = transformResult(processed);
      return result;
      }






  `;

  const newFile = dedent`



    // Not a reordering pattern
    function complexFunction() {
        const data = fetchData();
        const processed = processData(data);





      const result = transformResult(processed);
      // Added logging
      console.log('Function completed');
      return result;
      }










  `;

  const diff = await reorderAwareLazyEdit({
    oldFile,
    newLazyFile: newFile,

    filename: "complex.js",
    enableReorderOptimizations: true,
  });

  expect(diff).toBeDefined();

  // Should still work via fallback to standard approach
  const addedLines = diff?.filter((line) => line.type === "new") || [];

  expect(addedLines.some((line) => line.line.includes("Added logging"))).toBe(
    true,
  );
});
