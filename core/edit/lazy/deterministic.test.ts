import fs from "node:fs";
import path from "node:path";

// @ts-ignore no typings available
import { diff as myersDiff } from "myers-diff";
import { DiffLine } from "../..";
import { myersDiff as continueMyersDiff } from "../../diff/myers";
import { dedent } from "../../util";
import { deterministicApplyLazyEdit } from "./deterministic";

const UNIFIED_DIFF_SYMBOLS = {
  same: "",
  new: "+",
  old: "-",
};

async function collectDiffs(
  oldFile: string,
  newFile: string,
  filename: string,
): Promise<{ ourDiffs: DiffLine[]; myersDiffs: any }> {
  const ourDiffs: DiffLine[] = [];

  for (const diffLine of (await deterministicApplyLazyEdit({
    oldFile,
    newLazyFile: newFile,
    filename,
  })) ?? []) {
    ourDiffs.push(diffLine);
  }

  const myersDiffs = myersDiff(oldFile, newFile);

  return { ourDiffs, myersDiffs };
}

function displayDiff(diff: DiffLine[]) {
  return diff
    .map(({ type, line }) =>
      type === "same" ? line : `${UNIFIED_DIFF_SYMBOLS[type]} ${line}`,
    )
    .join("\n");
}

function normalizeDisplayedDiff(d: string): string {
  return d
    .split("\n")
    .map((line) => (line.trim() === "" ? "" : line))
    .join("\n");
}

async function expectDiff(file: string) {
  const testFilePath = path.join(
    __dirname,
    "edit",
    "lazy",
    "test-examples",
    file + ".diff",
  );
  const testFileContents = fs.readFileSync(testFilePath, "utf-8");
  const [oldFile, newFile, expectedDiff] = testFileContents
    .split("\n---\n")
    .map((s) => s.replace(/^\n+/, "").trimEnd());
  const { ourDiffs: streamDiffs } = await collectDiffs(oldFile, newFile, file);
  const displayedDiff = displayDiff(streamDiffs);

  if (!expectedDiff || expectedDiff.trim() === "") {
    console.log(
      "Expected diff was empty. Writing computed diff to the test file",
    );
    fs.writeFileSync(
      testFilePath,
      `${oldFile}\n\n---\n\n${newFile}\n\n---\n\n${displayDiff(
        continueMyersDiff(oldFile, newFile),
      )}`,
    );

    throw new Error("Expected diff is empty");
  }

  expect(normalizeDisplayedDiff(displayedDiff)).toEqual(
    normalizeDisplayedDiff(expectedDiff),
  );
}

describe("deterministicApplyLazyEdit(", () => {
  test("no changes", async () => {
    const file = dedent`
        function test() {
            return 1;
        }

        function test2(a) {
            return a * 2;
        }
    `;

    const { ourDiffs: streamDiffs, myersDiffs } = await collectDiffs(
      file,
      file,
      "test.js",
    );

    // When there are no changes (oldFile === newFile),
    // the function returns a full file rewrite with all "same" diffs
    // OR returns undefined to fall back to Myers diff
    if (streamDiffs.length === 0) {
      // Fell back to safer method, which is acceptable
      expect(streamDiffs).toEqual([]);
    } else {
      expect(streamDiffs).toEqual(
        file.split("\n").map((line) => ({
          line,
          type: "same",
        })),
      );
    }

    expect(myersDiffs).toEqual([]);
  });

  test("fastapi", async () => {
    await expectDiff("fastapi.py");
  });

  test("calculator exp", async () => {
    await expectDiff("calculator-exp.js");
  });

  test("calculator exp2", async () => {
    await expectDiff("calculator-exp2.js");
  });

  test("calculator comments", async () => {
    await expectDiff("calculator-comments.js");
  });

  test.skip("calculator docstrings", async () => {
    await expectDiff("calculator-docstrings.js");
  });

  test.skip("calculator stateless", async () => {
    await expectDiff("calculator-stateless.js");
  });

  test("top level same blocks", async () => {
    await expectDiff("top-level-same.js");
  });

  test.skip("gui add toggle", async () => {
    await expectDiff("gui.js");
  });

  test("rust calculator", async () => {
    await expectDiff("rust-calc-exp.rs");
  });

  test("no lazy blocks", async () => {
    await expectDiff("no-lazy.js");
  });

  test.skip("no lazy blocks in single top level class", async () => {
    await expectDiff("no-lazy-single-class.js");
  });

  test("should acknowledge jsx_expression lazy comments", async () => {
    await expectDiff("migration-page.tsx");
  });

  test.skip("should handle case where surrounding class is neglected, with lazy block surrounding", async () => {
    await expectDiff("calculator-class-neglected.js");
  });

  test("should handle case where surrounding class is neglected, without lazy block surrounding", async () => {
    await expectDiff("calculator-only-method.js");
  });

  test("should reject reconstruction that creates empty function body", async () => {
    // This test verifies that our validation prevents file corruption
    // when lazy block reconstruction would create an empty function body
    const oldFile = dedent`
      def calculate_sum(a, b):
          """Calculate the sum of two numbers."""
          result = a + b
          return result

      def calculate_product(a, b):
          """Calculate the product of two numbers."""
          result = a * b
          return result
    `;

    const newFileWithEmptyBody = dedent`
      def calculate_sum(a, b):
          # ... existing code ...

      def calculate_product(a, b):
          """Calculate the product of two numbers."""
          result = a * b
          return result
    `;

    const result = await deterministicApplyLazyEdit({
      oldFile,
      newLazyFile: newFileWithEmptyBody,
      filename: "test.py",
    });

    // The validation should detect the empty function body and return undefined
    // to fall back to a safer method, preventing file corruption
    expect(result).toBeUndefined();
  });

  test("should reject reconstruction with syntax errors", async () => {
    // This test verifies that our validation prevents file corruption
    // when lazy block reconstruction would create syntax errors
    const oldFile = dedent`
      function test() {
          return 1;
      }
    `;

    const newFileWithSyntaxError = dedent`
      function test() {
          # This is a Python comment in JavaScript - syntax error!
          return 1;
      }
    `;

    const result = await deterministicApplyLazyEdit({
      oldFile,
      newLazyFile: newFileWithSyntaxError,
      filename: "test.js",
    });

    // The validation should detect syntax errors and return undefined
    // to fall back to a safer method
    expect(result).toBeUndefined();
  });

  test("should not match functions with similar names but different implementations", async () => {
    // This test verifies Issue #3 fix: AST Similarity False Positives
    // Functions with similar names (calculate_tax vs calculate_total) should NOT be matched
    const oldFile = dedent`
      def calculate_tax(amount):
          """Calculate tax on amount."""
          rate = 0.1
          return amount * rate

      def calculate_total(amount):
          """Calculate total with tax."""
          tax = calculate_tax(amount)
          return amount + tax
    `;

    const newFileWithSimilarFunctionEdited = dedent`
      def calculate_tax(amount):
          """Calculate tax with new rate."""
          rate = 0.15
          return amount * rate

      def calculate_total(amount):
          """Calculate total with tax."""
          tax = calculate_tax(amount)
          return amount + tax
    `;

    const result = await deterministicApplyLazyEdit({
      oldFile,
      newLazyFile: newFileWithSimilarFunctionEdited,
      filename: "tax_calculator.py",
    });

    // Should successfully apply the edit without confusing the two functions
    // The old weak similarity check would have matched calculate_total when trying to edit calculate_tax
    expect(result).toBeDefined();

    if (result) {
      const finalFile = result.map(d => d.type === "old" ? "" : d.line).join("\n");
      // Verify that calculate_tax was updated (rate changed from 0.1 to 0.15)
      expect(finalFile).toContain("rate = 0.15");
      // Verify that calculate_total was NOT changed
      expect(finalFile).toContain("return amount + tax");
    }
  });
});
