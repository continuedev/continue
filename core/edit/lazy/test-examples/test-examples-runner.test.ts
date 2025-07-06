import * as fs from "fs";
import * as path from "path";
import { deterministicApplyLazyEdit } from "../deterministic";
import { importAwareLazyEdit } from "../optimizations/importOptimizations";
import { markdownAwareLazyEdit } from "../optimizations/markdownOptimizations";
import { reorderAwareLazyEdit } from "../optimizations/reorderAwareOptimizations";
import { similarFunctionAwareLazyEdit } from "../optimizations/similarFunctionOptimizations";
import { testAwareLazyEdit } from "../optimizations/testFileOptimizations";
import { unifiedLazyEdit } from "../unified-lazy-edit";

interface TestExample {
  name: string;
  original: string;
  modified: string;
  expectedDiff: string;
}

function parseTestExample(filePath: string): TestExample {
  const content = fs.readFileSync(filePath, "utf8");

  // More robust parsing: look for sections separated by standalone '---' lines
  const parts = content.split("\n---\n");

  if (parts.length >= 3) {
    return {
      name: path.basename(filePath, ".diff"),
      original: parts[0].trim(),
      modified: parts[1].trim(),
      expectedDiff: parts[2].trim(),
    };
  }

  console.warn(
    `Warning: Could not parse ${filePath} - found ${parts.length} sections, expected 3. Skipping.`,
  );
  return {
    name: path.basename(filePath, ".diff"),
    original: "",
    modified: "",
    expectedDiff: "",
  };
}

function loadTestExamples(): TestExample[] {
  // Use explicit path to test examples directory instead of __dirname
  const testDir = path.join(process.cwd(), "edit", "lazy", "test-examples");
  console.log("Test directory:", testDir);

  try {
    const files = fs.readdirSync(testDir);
    console.log(`Found ${files.length} files in directory`);

    const diffFiles = files
      .filter((file) => file.endsWith(".diff"))
      .map((file) => path.join(testDir, file));

    console.log(`Found ${diffFiles.length} .diff files`);
    return diffFiles.map((file) => parseTestExample(file));
  } catch (error) {
    console.error("Error reading test directory:", error);
    return [];
  }
}

const testExamples = loadTestExamples();

function getFilenameFromTest(testName: string): string {
  if (testName.includes("markdown")) return "test.md";
  if (testName.includes("react") || testName.includes("migration"))
    return "test.tsx";
  if (testName.includes("rust")) return "test.rs";
  if (testName.includes("py")) return "test.py";
  return "test.js";
}

async function runOptimizationTest(
  testExample: TestExample,
  optimizationType: string,
  optimizationFn: (params: any) => Promise<any>,
  options: Record<string, any> = {},
) {
  try {
    const result = await optimizationFn({
      oldFile: testExample.original,
      newLazyFile: testExample.modified,
      filename: getFilenameFromTest(testExample.name),
      ...options,
    });

    if (result) {
      const hasChanges = result.some((line: any) => line.type !== "same");
      return {
        success: true,
        diffLines: result.length,
        hasChanges,
      };
    } else {
      return {
        success: false,

        error: "No result returned",
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

test("should compare optimizations vs deterministic approach", async () => {
  // Check if we have test examples loaded
  if (testExamples.length === 0) {
    console.log(
      "No test examples found. Make sure .diff files exist in the directory.",
    );
    return;
  }

  // Just test a couple of examples to check if the test runner works
  const comparisonTests = ["calculator-exp.js", "function-reordering"];

  for (const testName of comparisonTests) {
    const testExample = testExamples.find((t) => t.name === testName);
    if (!testExample) {
      console.log(
        `Test ${testName} not found in:`,
        testExamples.map((t) => t.name),
      );
      continue;
    }

    // Run deterministic approach
    const deterministicResult = await runOptimizationTest(
      testExample,
      "deterministic",

      async ({ oldFile, newLazyFile, filename }) =>
        deterministicApplyLazyEdit({
          oldFile,
          newLazyFile,
          filename,
        }),
    );

    // Run optimizations
    const optimizationResults = await Promise.all([
      runOptimizationTest(testExample, "import-aware", importAwareLazyEdit),
      runOptimizationTest(testExample, "markdown-aware", markdownAwareLazyEdit),
      runOptimizationTest(testExample, "reorder-aware", reorderAwareLazyEdit),

      runOptimizationTest(
        testExample,
        "similar-function-aware",
        similarFunctionAwareLazyEdit,
      ),
      runOptimizationTest(testExample, "test-aware", testAwareLazyEdit),
      runOptimizationTest(testExample, "unified", unifiedLazyEdit),
    ]);

    // Log results for comparison
    console.log(`\nResults for ${testName}:`);

    console.log(
      `- deterministic: ${deterministicResult.success ? deterministicResult.diffLines : "failed"}`,
    );

    const optimizationNames = [
      "import-aware",
      "markdown-aware",
      "reorder-aware",
      "similar-function-aware",
      "test-aware",
      "unified",
    ];

    optimizationResults.forEach((result, index) => {
      console.log(
        `- ${optimizationNames[index]}: ${result.success ? result.diffLines : "failed"}`,
      );
    });

    expect(deterministicResult.success).toBe(true);
  }
});
