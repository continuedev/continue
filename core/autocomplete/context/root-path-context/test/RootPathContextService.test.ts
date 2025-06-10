import { describe, test } from "vitest";
import { PYTHON_TEST_CASES, TYPESCRIPT_TEST_CASES } from "./testCases";
import { testRootPathContext } from "./testUtils";

const TEST_CASES = [
  ...PYTHON_TEST_CASES,
  ...TYPESCRIPT_TEST_CASES,
  {
    nodeType: "function_definition",
    fileName: "file1.php",
    language: "PHP",
    cursorPosition: { line: 12, character: 32 },
    definitionPositions: [
      { row: 10, column: 26 }, // Person
      { row: 10, column: 44 }, // Address
    ],
  },
  {
    nodeType: "method_declaration",
    fileName: "file1.php",
    language: "PHP",
    cursorPosition: { line: 26, character: 35 },
    definitionPositions: [
      { row: 15, column: 29 }, // BaseClass
      { row: 15, column: 55 }, // FirstInterface
      { row: 15, column: 72 }, // SecondInterface
      { row: 25, column: 43 }, // Person
      { row: 25, column: 61 }, // Address
    ],
  },
  {
    nodeType: "function_declaration",
    fileName: "file1.go",
    language: "Go",
    cursorPosition: { line: 7, character: 21 },
    definitionPositions: [
      { row: 6, column: 33 }, // models.User
      { row: 6, column: 50 }, // models.Address
    ],
  },
];

describe("RootPathContextService", () => {
  describe("should look for correct type definitions", () => {
    test.each(TEST_CASES)(
      "$language: $nodeType",
      async ({ fileName, cursorPosition, definitionPositions }) => {
        await testRootPathContext(
          "files",
          fileName,
          cursorPosition,
          definitionPositions,
        );
      },
    );
  });
});
