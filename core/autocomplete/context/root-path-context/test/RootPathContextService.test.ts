import { testRootPathContext } from "./testUtils";

const TEST_CASES = [
  {
    nodeType: "function_declaration",
    fileName: "file1.ts",
    language: "TypeScript",
    cursorPosition: { line: 10, character: 24 },
    positions: [
      { row: 9, column: 34 }, // Person
      { row: 9, column: 44 }, // Address
    ],
  },
  {
    nodeType: "method_declaration",
    fileName: "file1.ts",
    language: "TypeScript",
    cursorPosition: { line: 22, character: 30 },
    positions: [
      { row: 13, column: 29 }, // BaseClass
      { row: 13, column: 55 }, // FirstInterface
      { row: 13, column: 72 }, // SecondInterface
      { row: 21, column: 33 }, // Person
      { row: 21, column: 43 }, // Address
    ],
  },
  {
    nodeType: "function_definition",
    fileName: "file1.py",
    language: "Python",
    cursorPosition: { line: 12, character: 33 },
    positions: [
      { row: 6, column: 21 },
      { row: 6, column: 37 },
      { row: 6, column: 54 },
    ],
  },
];

describe("RootPathContextService", () => {
  test.each(TEST_CASES)(
    "Should look for correct type definitions when editing inside a $nodeType in $language",
    async ({ fileName, cursorPosition, positions }) => {
      await testRootPathContext("files", fileName, cursorPosition, positions);
    },
  );
});
