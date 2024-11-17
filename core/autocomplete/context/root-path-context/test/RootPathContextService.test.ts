import { TYPESCRIPT_TEST_CASES } from "./testCases/typescript";
import { testRootPathContext } from "./testUtils";

const TEST_CASES = [
  ...TYPESCRIPT_TEST_CASES,
  {
    nodeType: "function_definition",
    fileName: "file1.py",
    language: "Python",
    cursorPosition: { line: 4, character: 25 },
    definitionPositions: [
      { row: 3, column: 30 }, // Person
      { row: 3, column: 42 }, // Address
    ],
  },
  {
    nodeType: "function_definition (inside a class)",
    fileName: "file1.py",
    language: "Python",
    cursorPosition: { line: 12, character: 33 },
    definitionPositions: [
      { row: 6, column: 21 }, // BaseClass
      { row: 6, column: 33 }, // Collection
      { row: 11, column: 47 }, // Person
      { row: 11, column: 59 }, // Address
    ],
  },
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
